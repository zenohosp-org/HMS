package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.AdmissionDTO;
import com.zenlocare.HMS_backend.dto.AdmissionRequest;
import com.zenlocare.HMS_backend.dto.DischargeRequest;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdmissionService {

    private final AdmissionRepository admissionRepository;
    private final HospitalRepository hospitalRepository;
    private final PatientRepository patientRepository;
    private final RoomRepository roomRepository;
    private final BedRepository bedRepository;
    private final DoctorRepository doctorRepository;
    private final DepartmentRepository departmentRepository;
    private final AppointmentRepository appointmentRepository;
    private final RoomLogRepository roomLogRepository;
    private final UserRepository userRepository;

    @Transactional
    public AdmissionDTO admit(AdmissionRequest req, String performedBy) {
        Hospital hospital = hospitalRepository.findById(req.getHospitalId())
                .orElseThrow(() -> new RuntimeException("Hospital not found"));
        Patient patient = patientRepository.findById(req.getPatientId())
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        admissionRepository.findByPatientIdAndStatus(req.getPatientId(), AdmissionStatus.ADMITTED)
                .ifPresent(a -> { throw new RuntimeException("Patient is already admitted (ADM: " + a.getAdmissionNumber() + ")"); });

        Doctor doctor = req.getAdmittingDoctorId() != null
                ? doctorRepository.findById(req.getAdmittingDoctorId()).orElse(null) : null;
        Department dept = req.getDepartmentId() != null
                ? departmentRepository.findById(req.getDepartmentId()).orElse(null) : null;
        Appointment sourceAppt = req.getSourceAppointmentId() != null
                ? appointmentRepository.findById(req.getSourceAppointmentId()).orElse(null) : null;

        Room room = null;
        if (req.getRoomId() != null) {
            room = roomRepository.findById(req.getRoomId())
                    .orElseThrow(() -> new RuntimeException("Room not found"));
            if (room.getStatus() != RoomStatus.AVAILABLE) {
                throw new RuntimeException("Room is not available");
            }
        }

        Bed bed = null;
        if (req.getBedId() != null) {
            bed = bedRepository.findById(req.getBedId())
                    .orElseThrow(() -> new RuntimeException("Bed not found"));
            if (bed.getStatus() != BedStatus.AVAILABLE) {
                throw new RuntimeException("Selected bed is not available");
            }
        } else if (room != null) {
            boolean isMultiBed = room.getBedCount() != null && room.getBedCount() > 1;
            if (!isMultiBed) {
                bed = bedRepository.findFirstByRoomIdAndStatus(room.getId(), BedStatus.AVAILABLE).orElse(null);
            }
        }

        String admNumber = generateAdmissionNumber(hospital.getId());
        String ipdId = generateIpdId(hospital.getId());

        Admission admission = Admission.builder()
                .hospital(hospital)
                .patient(patient)
                .room(room)
                .bed(bed)
                .admittingDoctor(doctor)
                .department(dept)
                .sourceAppointment(sourceAppt)
                .admissionNumber(admNumber)
                .ipdId(ipdId)
                .admissionType(req.getAdmissionType() != null ? req.getAdmissionType() : AdmissionType.ELECTIVE)
                .admissionSource(req.getAdmissionSource() != null ? req.getAdmissionSource() : AdmissionSource.DIRECT)
                .chiefComplaint(req.getChiefComplaint())
                .approxDischargeDate(req.getApproxDischargeDate())
                .attenderName(req.getAttenderName())
                .attenderPhone(req.getAttenderPhone())
                .attenderRelationship(req.getAttenderRelationship())
                .status(AdmissionStatus.ADMITTED)
                .build();

        Admission saved = admissionRepository.save(admission);

        if (room != null) {
            boolean isMultiBed = room.getBedCount() != null && room.getBedCount() > 1;

            if (bed != null) {
                bed.setStatus(BedStatus.OCCUPIED);
                bed.setCurrentPatient(patient);
                bedRepository.save(bed);
            }

            if (isMultiBed) {
                long availableBeds = bedRepository.countByRoomIdAndStatus(room.getId(), BedStatus.AVAILABLE);
                if (availableBeds == 0) {
                    room.setStatus(RoomStatus.OCCUPIED);
                }
            } else {
                room.setStatus(RoomStatus.OCCUPIED);
                room.setCurrentPatient(patient);
                room.setAttenderName(req.getAttenderName());
                room.setAttenderPhone(req.getAttenderPhone());
                room.setAttenderRelationship(req.getAttenderRelationship());
                room.setAdmissionDate(saved.getAdmissionDate());
                room.setApproxDischargeTime(req.getApproxDischargeDate());
            }
            roomRepository.save(room);

            roomLogRepository.save(RoomLog.builder()
                    .room(room).hospital(hospital)
                    .event(RoomLogEvent.ALLOCATED)
                    .roomNumber(room.getRoomNumber())
                    .patientName(patient.getFirstName() + " " + patient.getLastName())
                    .patientMrn(patient.getMrn())
                    .attenderName(req.getAttenderName())
                    .allocationToken(admNumber)
                    .performedBy(performedBy)
                    .build());
        }

        return toDTO(saved);
    }

    @Transactional
    public AdmissionDTO assignRoom(UUID admissionId, Long roomId, String performedBy) {
        Admission admission = admissionRepository.findById(admissionId)
                .orElseThrow(() -> new RuntimeException("Admission not found"));
        if (admission.getStatus() != AdmissionStatus.ADMITTED) {
            throw new RuntimeException("Admission is not active");
        }
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));
        if (room.getStatus() != RoomStatus.AVAILABLE) {
            throw new RuntimeException("Room is not available");
        }

        boolean isMultiBed = room.getBedCount() != null && room.getBedCount() > 1;

        Bed bed = null;
        if (!isMultiBed) {
            bed = bedRepository.findFirstByRoomIdAndStatus(room.getId(), BedStatus.AVAILABLE).orElse(null);
            if (bed != null) {
                bed.setStatus(BedStatus.OCCUPIED);
                bed.setCurrentPatient(admission.getPatient());
                bedRepository.save(bed);
            }
            room.setStatus(RoomStatus.OCCUPIED);
            room.setCurrentPatient(admission.getPatient());
            room.setAdmissionDate(LocalDateTime.now());
            room.setAttenderName(admission.getAttenderName());
            room.setAttenderPhone(admission.getAttenderPhone());
            room.setAttenderRelationship(admission.getAttenderRelationship());
        }
        roomRepository.save(room);

        admission.setRoom(room);
        if (bed != null) admission.setBed(bed);
        admission.setAdmissionDate(LocalDateTime.now());
        admissionRepository.save(admission);

        roomLogRepository.save(RoomLog.builder()
                .room(room).hospital(admission.getHospital())
                .event(RoomLogEvent.ALLOCATED)
                .roomNumber(room.getRoomNumber())
                .patientName(admission.getPatient().getFirstName() + " " + admission.getPatient().getLastName())
                .patientMrn(admission.getPatient().getMrn())
                .allocationToken(admission.getAdmissionNumber())
                .performedBy(performedBy)
                .build());

        return toDTO(admission);
    }

    @Transactional
    public AdmissionDTO discharge(UUID admissionId, DischargeRequest req, String performedBy) {
        Admission admission = admissionRepository.findById(admissionId)
                .orElseThrow(() -> new RuntimeException("Admission not found"));
        if (admission.getStatus() != AdmissionStatus.ADMITTED) {
            throw new RuntimeException("Admission is not active");
        }

        LocalDateTime dischargeTime = req.getActualDischargeDate() != null
                ? req.getActualDischargeDate() : LocalDateTime.now();

        admission.setStatus(AdmissionStatus.DISCHARGED);
        admission.setActualDischargeDate(dischargeTime);
        admission.setDischargeDiagnosis(req.getDischargeDiagnosis());
        admission.setDischargeNote(req.getDischargeNote());

        if (admission.getBed() != null) {
            Bed bed = admission.getBed();
            bed.setStatus(BedStatus.AVAILABLE);
            bed.setCurrentPatient(null);
            bedRepository.save(bed);

            if (admission.getRoom() != null) {
                Room room = admission.getRoom();
                long occupiedCount = bedRepository.countByRoomIdAndStatus(room.getId(), BedStatus.OCCUPIED);
                if (occupiedCount == 0) {
                    room.setStatus(RoomStatus.AVAILABLE);
                    room.setCurrentPatient(null);
                    room.setApproxDischargeTime(null);
                    room.setAttenderName(null);
                    room.setAttenderPhone(null);
                    room.setAttenderRelationship(null);
                    room.setAdmissionDate(null);
                    roomRepository.save(room);

                    roomLogRepository.save(RoomLog.builder()
                            .room(room).hospital(admission.getHospital())
                            .event(RoomLogEvent.DEALLOCATED)
                            .roomNumber(room.getRoomNumber())
                            .patientName(admission.getPatient().getFirstName() + " " + admission.getPatient().getLastName())
                            .patientMrn(admission.getPatient().getMrn())
                            .performedBy(performedBy)
                            .build());
                }
            }
        } else if (admission.getRoom() != null) {
            Room room = admission.getRoom();
            String patName = admission.getPatient().getFirstName() + " " + admission.getPatient().getLastName();

            room.setStatus(RoomStatus.AVAILABLE);
            room.setCurrentPatient(null);
            room.setApproxDischargeTime(null);
            room.setAttenderName(null);
            room.setAttenderPhone(null);
            room.setAttenderRelationship(null);
            room.setAdmissionDate(null);
            roomRepository.save(room);

            bedRepository.findByRoomIdOrderByBedNumberAsc(room.getId()).forEach(b -> {
                if (b.getCurrentPatient() != null &&
                        b.getCurrentPatient().getId().equals(admission.getPatient().getId())) {
                    b.setStatus(BedStatus.AVAILABLE);
                    b.setCurrentPatient(null);
                    bedRepository.save(b);
                }
            });

            roomLogRepository.save(RoomLog.builder()
                    .room(room).hospital(admission.getHospital())
                    .event(RoomLogEvent.DEALLOCATED)
                    .roomNumber(room.getRoomNumber())
                    .patientName(patName)
                    .patientMrn(admission.getPatient().getMrn())
                    .performedBy(performedBy)
                    .build());
        }

        return toDTO(admissionRepository.save(admission));
    }

    @Transactional
    public AdmissionDTO moveToOT(UUID admissionId, Long roomId, UUID doctorId, String performedBy) {
        Admission admission = admissionRepository.findById(admissionId)
                .orElseThrow(() -> new RuntimeException("Admission not found"));
        if (admission.getStatus() != AdmissionStatus.ADMITTED)
            throw new RuntimeException("Admission is not active");

        Room otRoom = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("OT room not found"));
        if (otRoom.getRoomType() != com.zenlocare.HMS_backend.entity.RoomType.OT)
            throw new RuntimeException("Selected room is not an OT room");
        if (otRoom.getStatus() != RoomStatus.AVAILABLE)
            throw new RuntimeException("OT room is not available");

        // Vacate current room if any
        roomRepository.findByCurrentPatientId(admission.getPatient().getId()).ifPresent(prev -> {
            prev.setStatus(RoomStatus.AVAILABLE);
            prev.setCurrentPatient(null);
            prev.setApproxDischargeTime(null);
            roomRepository.save(prev);
        });

        // Occupy OT room
        otRoom.setStatus(RoomStatus.OCCUPIED);
        otRoom.setCurrentPatient(admission.getPatient());
        otRoom.setAdmissionDate(LocalDateTime.now());
        Room savedRoom = roomRepository.save(otRoom);

        // Update admission room and optionally doctor
        admission.setRoom(savedRoom);
        if (doctorId != null) {
            doctorRepository.findById(doctorId).ifPresent(admission::setAdmittingDoctor);
        }

        roomLogRepository.save(com.zenlocare.HMS_backend.entity.RoomLog.builder()
                .room(savedRoom)
                .hospital(admission.getHospital())
                .event(com.zenlocare.HMS_backend.entity.RoomLogEvent.ALLOCATED)
                .roomNumber(savedRoom.getRoomNumber())
                .patientName(admission.getPatient().getFirstName() + " " + admission.getPatient().getLastName())
                .patientMrn(admission.getPatient().getMrn())
                .performedBy(performedBy)
                .build());

        return toDTO(admissionRepository.save(admission));
    }

    public List<AdmissionDTO> getActive(UUID hospitalId) {
        return admissionRepository.findByHospitalIdAndStatusOrderByAdmissionDateDesc(hospitalId, AdmissionStatus.ADMITTED)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<AdmissionDTO> getAll(UUID hospitalId) {
        return admissionRepository.findByHospitalIdOrderByAdmissionDateDesc(hospitalId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<AdmissionDTO> getByPatient(Integer patientId) {
        return admissionRepository.findByPatientIdOrderByAdmissionDateDesc(patientId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public AdmissionDTO get(UUID id) {
        return toDTO(admissionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Admission not found")));
    }

    private String generateAdmissionNumber(UUID hospitalId) {
        String year = String.valueOf(LocalDateTime.now().getYear());
        long total = admissionRepository.findByHospitalIdOrderByAdmissionDateDesc(hospitalId).size();
        return "ADM-" + year + "-" + String.format("%04d", total + 1);
    }

    private String generateIpdId(UUID hospitalId) {
        String year = String.valueOf(LocalDateTime.now().getYear());
        String prefix = "IPD-" + year + "-";
        return admissionRepository.findMaxIpdIdForYear(hospitalId, year)
                .filter(max -> max != null)
                .map(max -> {
                    int seq = Integer.parseInt(max.replace(prefix, "")) + 1;
                    return prefix + String.format("%04d", seq);
                })
                .orElse(prefix + "0001");
    }

    public AdmissionDTO toDTO(Admission a) {
        // If room/bed weren't set on the admission (pre-fix allocations), look up via bed table
        Room room = a.getRoom();
        com.zenlocare.HMS_backend.entity.Bed bed = a.getBed();
        if (room == null && a.getStatus() == AdmissionStatus.ADMITTED) {
            bed = bedRepository.findByCurrentPatientId(a.getPatient().getId()).orElse(null);
            if (bed != null) room = bed.getRoom();
        }
        final Room resolvedRoom = room;
        final com.zenlocare.HMS_backend.entity.Bed resolvedBed = bed;
        return AdmissionDTO.builder()
                .id(a.getId())
                .admissionNumber(a.getAdmissionNumber())
                .ipdId(a.getIpdId())
                .patientId(a.getPatient().getId())
                .patientName(a.getPatient().getFirstName() + " " + a.getPatient().getLastName())
                .patientMrn(a.getPatient().getMrn())
                .roomId(resolvedRoom != null ? resolvedRoom.getId() : null)
                .roomNumber(resolvedRoom != null ? resolvedRoom.getRoomNumber() : null)
                .roomType(resolvedRoom != null ? resolvedRoom.getRoomType().name() : null)
                .roomPricePerDay(resolvedRoom != null ? resolvedRoom.getPricePerDay() : null)
                .bedId(resolvedBed != null ? resolvedBed.getId() : null)
                .bedNumber(resolvedBed != null ? resolvedBed.getBedNumber() : null)
                .admittingDoctorId(a.getAdmittingDoctor() != null ? a.getAdmittingDoctor().getId() : null)
                .admittingDoctorName(a.getAdmittingDoctor() != null
                        ? a.getAdmittingDoctor().getUser().getFirstName() + " " + a.getAdmittingDoctor().getUser().getLastName()
                        : null)
                .departmentId(a.getDepartment() != null ? a.getDepartment().getId() : null)
                .departmentName(a.getDepartment() != null ? a.getDepartment().getName() : null)
                .sourceAppointmentId(a.getSourceAppointment() != null ? a.getSourceAppointment().getId() : null)
                .admissionType(a.getAdmissionType())
                .admissionSource(a.getAdmissionSource())
                .chiefComplaint(a.getChiefComplaint())
                .primaryDiagnosis(a.getPrimaryDiagnosis())
                .dischargeDiagnosis(a.getDischargeDiagnosis())
                .dischargeNote(a.getDischargeNote())
                .attenderName(a.getAttenderName())
                .attenderPhone(a.getAttenderPhone())
                .attenderRelationship(a.getAttenderRelationship())
                .status(a.getStatus())
                .admissionDate(a.getAdmissionDate())
                .actualDischargeDate(a.getActualDischargeDate())
                .approxDischargeDate(a.getApproxDischargeDate())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
