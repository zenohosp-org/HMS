package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.AttenderUpdateRequest;
import com.zenlocare.HMS_backend.dto.BedDto;
import com.zenlocare.HMS_backend.dto.RoomAllocationRequest;
import com.zenlocare.HMS_backend.dto.RoomCreateRequest;
import com.zenlocare.HMS_backend.dto.RoomLogDTO;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final HospitalRepository hospitalRepository;
    private final PatientRepository patientRepository;
    private final RoomLogRepository roomLogRepository;
    private final DepartmentRepository departmentRepository;
    private final AdmissionRepository admissionRepository;
    private final BedRepository bedRepository;

    public List<Room> getRoomsForHospital(UUID hospitalId) {
        return roomRepository.findByHospitalId(hospitalId);
    }

    public List<BedDto> getBedsByRoom(Long roomId, UUID hospitalId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));
        if (!room.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Room does not belong to this hospital");
        }
        return bedRepository.findByRoomIdOrderByBedNumberAsc(roomId).stream()
                .map(BedDto::fromEntity)
                .collect(Collectors.toList());
    }

    private String generateRoomCode(UUID hospitalId) {
        return roomRepository.findMaxRoomCode(hospitalId)
                .filter(max -> max != null)
                .map(max -> {
                    int seq = Integer.parseInt(max.replace("RM-", "")) + 1;
                    return "RM-" + String.format("%04d", seq);
                })
                .orElse("RM-0001");
    }

    @Transactional
    public List<Room> generateRooms(RoomCreateRequest request, String performedBy) {
        Hospital hospital = hospitalRepository.findById(request.getHospitalId())
                .orElseThrow(() -> new RuntimeException("Hospital not found"));

        int bedCount = request.getBedCount() != null && request.getBedCount() > 0
                ? request.getBedCount() : 1;

        List<Room> newRooms = new ArrayList<>();
        for (int i = 1; i <= request.getCount(); i++) {
            String tempRoomNumber = request.getRoomPrefix() + "-" + String.format("%02d", i);
            int counter = i;
            while (roomRepository.findByHospitalIdAndRoomNumber(hospital.getId(), tempRoomNumber).isPresent()) {
                counter += 100;
                tempRoomNumber = request.getRoomPrefix() + "-" + String.format("%02d", counter);
            }

            Department dept = request.getDepartmentId() != null
                    ? departmentRepository.findById(request.getDepartmentId()).orElse(null) : null;

            Room room = Room.builder()
                    .hospital(hospital)
                    .roomNumber(tempRoomNumber)
                    .roomCode(generateRoomCode(hospital.getId()))
                    .roomType(request.getRoomType())
                    .pricePerDay(request.getPricePerDay())
                    .status(RoomStatus.AVAILABLE)
                    .bedCount(bedCount)
                    .department(dept)
                    .ward(request.getWard())
                    .build();

            Room saved = roomRepository.save(room);
            newRooms.add(saved);

            for (int b = 1; b <= bedCount; b++) {
                bedRepository.save(Bed.builder()
                        .room(saved)
                        .bedNumber("Bed " + b)
                        .status(BedStatus.AVAILABLE)
                        .build());
            }

            roomLogRepository.save(RoomLog.builder()
                    .room(saved)
                    .hospital(hospital)
                    .event(RoomLogEvent.ROOM_CREATED)
                    .roomNumber(saved.getRoomNumber())
                    .performedBy(performedBy)
                    .build());
        }

        return newRooms;
    }

    @Transactional
    public Room allocatePatient(RoomAllocationRequest request, UUID hospitalId, String performedBy) {
        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!room.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Room does not belong to this hospital");
        }
        if (room.getStatus() != RoomStatus.AVAILABLE) {
            throw new RuntimeException("Room is not available");
        }

        Patient patient = patientRepository.findById(request.getPatientId())
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        if (!patient.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Patient does not belong to this hospital");
        }

        roomRepository.findByCurrentPatientId(patient.getId()).ifPresent(existingRoom -> {
            existingRoom.setStatus(RoomStatus.AVAILABLE);
            existingRoom.setCurrentPatient(null);
            existingRoom.setApproxDischargeTime(null);
            roomRepository.save(existingRoom);
        });

        boolean isMultiBed = room.getBedCount() != null && room.getBedCount() > 1;
        Bed allocatedBed = null;

        if (isMultiBed) {
            Bed bed;
            if (request.getBedId() != null) {
                bed = bedRepository.findById(request.getBedId())
                        .orElseThrow(() -> new RuntimeException("Bed not found"));
                if (bed.getStatus() != BedStatus.AVAILABLE) {
                    throw new RuntimeException("Selected bed is not available");
                }
            } else {
                bed = bedRepository.findFirstByRoomIdAndStatus(room.getId(), BedStatus.AVAILABLE)
                        .orElseThrow(() -> new RuntimeException("No available beds in this room"));
            }
            bed.setStatus(BedStatus.OCCUPIED);
            bed.setCurrentPatient(patient);
            allocatedBed = bedRepository.save(bed);

            long availableBeds = bedRepository.countByRoomIdAndStatus(room.getId(), BedStatus.AVAILABLE);
            if (availableBeds == 0) {
                room.setStatus(RoomStatus.OCCUPIED);
            }
        } else {
            room.setStatus(RoomStatus.OCCUPIED);
            room.setCurrentPatient(patient);
            room.setAttenderName(request.getAttenderName());
            room.setAttenderPhone(request.getAttenderPhone());
            room.setAttenderRelationship(request.getAttenderRelationship());
            room.setAllocationToken(generateToken());
            room.setAdmissionDate(LocalDateTime.now());
            if (request.getApproxDischargeTime() != null) {
                room.setApproxDischargeTime(request.getApproxDischargeTime());
            }
            Optional<Bed> singleBed = bedRepository.findFirstByRoomIdAndStatus(room.getId(), BedStatus.AVAILABLE);
            if (singleBed.isPresent()) {
                Bed b = singleBed.get();
                b.setStatus(BedStatus.OCCUPIED);
                b.setCurrentPatient(patient);
                allocatedBed = bedRepository.save(b);
            }
        }

        Room saved = roomRepository.save(room);

        // Sync room + bed back to the active admission so discharge billing can read them
        final Bed finalBed = allocatedBed;
        admissionRepository.findByPatientIdAndStatus(patient.getId(), AdmissionStatus.ADMITTED)
                .ifPresent(admission -> {
                    admission.setRoom(saved);
                    admission.setBed(finalBed);
                    admissionRepository.save(admission);
                });

        roomLogRepository.save(RoomLog.builder()
                .room(saved)
                .hospital(saved.getHospital())
                .event(RoomLogEvent.ALLOCATED)
                .roomNumber(saved.getRoomNumber())
                .patientName(patient.getFirstName() + " " + patient.getLastName())
                .patientMrn(patient.getMrn())
                .attenderName(request.getAttenderName())
                .allocationToken(saved.getAllocationToken())
                .performedBy(performedBy)
                .build());

        return saved;
    }

    @Transactional
    public Room deallocatePatient(Long roomId, UUID hospitalId, String performedBy) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!room.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Room does not belong to this hospital");
        }

        String patientName = room.getCurrentPatient() != null
                ? room.getCurrentPatient().getFirstName() + " " + room.getCurrentPatient().getLastName()
                : null;
        String patientMrn = room.getCurrentPatient() != null ? room.getCurrentPatient().getMrn() : null;

        room.setStatus(RoomStatus.AVAILABLE);
        room.setCurrentPatient(null);
        room.setApproxDischargeTime(null);
        room.setAdmissionDate(null);
        room.setAttenderName(null);
        room.setAttenderPhone(null);
        room.setAttenderRelationship(null);
        room.setAllocationToken(null);

        bedRepository.findByRoomIdOrderByBedNumberAsc(roomId).forEach(b -> {
            b.setStatus(BedStatus.AVAILABLE);
            b.setCurrentPatient(null);
            bedRepository.save(b);
        });

        Room saved = roomRepository.save(room);

        admissionRepository.findByRoomIdAndStatus(roomId, AdmissionStatus.ADMITTED)
                .ifPresent(admission -> {
                    admission.setStatus(AdmissionStatus.DISCHARGED);
                    admission.setActualDischargeDate(LocalDateTime.now());
                    admissionRepository.save(admission);
                });

        roomLogRepository.save(RoomLog.builder()
                .room(saved)
                .hospital(saved.getHospital())
                .event(RoomLogEvent.DEALLOCATED)
                .roomNumber(saved.getRoomNumber())
                .patientName(patientName)
                .patientMrn(patientMrn)
                .performedBy(performedBy)
                .build());

        return saved;
    }

    @Transactional
    public BedDto freeBed(Long bedId, UUID hospitalId, String performedBy) {
        Bed bed = bedRepository.findById(bedId)
                .orElseThrow(() -> new RuntimeException("Bed not found"));

        Room room = bed.getRoom();
        if (!room.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Bed does not belong to this hospital");
        }

        String patientName = bed.getCurrentPatient() != null
                ? bed.getCurrentPatient().getFirstName() + " " + bed.getCurrentPatient().getLastName()
                : null;
        String patientMrn = bed.getCurrentPatient() != null ? bed.getCurrentPatient().getMrn() : null;

        bed.setStatus(BedStatus.AVAILABLE);
        bed.setCurrentPatient(null);
        bedRepository.save(bed);

        long occupiedCount = bedRepository.countByRoomIdAndStatus(room.getId(), BedStatus.OCCUPIED);
        if (occupiedCount == 0) {
            room.setStatus(RoomStatus.AVAILABLE);
            room.setCurrentPatient(null);
            roomRepository.save(room);
        }

        roomLogRepository.save(RoomLog.builder()
                .room(room)
                .hospital(room.getHospital())
                .event(RoomLogEvent.DEALLOCATED)
                .roomNumber(room.getRoomNumber())
                .patientName(patientName)
                .patientMrn(patientMrn)
                .performedBy(performedBy)
                .build());

        return BedDto.fromEntity(bed);
    }

    @Transactional
    public Room updateAttender(Long roomId, AttenderUpdateRequest request, UUID hospitalId, String performedBy) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!room.getHospital().getId().equals(hospitalId)) {
            throw new RuntimeException("Room does not belong to this hospital");
        }
        if (room.getStatus() != RoomStatus.OCCUPIED) {
            throw new RuntimeException("Room is not occupied");
        }

        boolean isNew = room.getAttenderName() == null;
        room.setAttenderName(request.getAttenderName());
        room.setAttenderPhone(request.getAttenderPhone());
        room.setAttenderRelationship(request.getAttenderRelationship());

        Room saved = roomRepository.save(room);

        String patientName = saved.getCurrentPatient() != null
                ? saved.getCurrentPatient().getFirstName() + " " + saved.getCurrentPatient().getLastName()
                : null;
        String patientMrn = saved.getCurrentPatient() != null ? saved.getCurrentPatient().getMrn() : null;

        roomLogRepository.save(RoomLog.builder()
                .room(saved)
                .hospital(saved.getHospital())
                .event(isNew ? RoomLogEvent.ATTENDER_ASSIGNED : RoomLogEvent.ATTENDER_UPDATED)
                .roomNumber(saved.getRoomNumber())
                .patientName(patientName)
                .patientMrn(patientMrn)
                .attenderName(request.getAttenderName())
                .allocationToken(saved.getAllocationToken())
                .performedBy(performedBy)
                .build());

        return saved;
    }

    public List<RoomLogDTO> getHospitalLogs(UUID hospitalId, String search) {
        List<RoomLog> logs = (search != null && !search.isBlank())
                ? roomLogRepository.searchByHospital(hospitalId, search.trim())
                : roomLogRepository.findByHospitalIdOrderByCreatedAtDesc(hospitalId);
        return logs.stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<RoomLogDTO> getRoomLogs(Long roomId, UUID hospitalId) {
        return roomLogRepository.findByRoomIdOrderByCreatedAtDesc(roomId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public void deleteRoom(Long roomId, UUID hospitalId) {
        Room room = roomRepository.findById(roomId)
                .filter(r -> r.getHospital().getId().equals(hospitalId))
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
        if (room.getStatus() == RoomStatus.OCCUPIED) {
            throw new IllegalStateException("Cannot delete an occupied room. Deallocate the patient first.");
        }
        admissionRepository.findByRoomId(roomId).forEach(a -> {
            a.setRoom(null);
            admissionRepository.save(a);
        });
        roomLogRepository.deleteByRoomId(roomId);
        roomRepository.delete(room);
    }

    private RoomLogDTO toDTO(RoomLog log) {
        return RoomLogDTO.builder()
                .id(log.getId())
                .roomId(log.getRoom().getId())
                .roomNumber(log.getRoomNumber())
                .event(log.getEvent().name())
                .patientName(log.getPatientName())
                .patientMrn(log.getPatientMrn())
                .attenderName(log.getAttenderName())
                .allocationToken(log.getAllocationToken())
                .performedBy(log.getPerformedBy())
                .createdAt(log.getCreatedAt())
                .build();
    }

    private String generateToken() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder token = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            token.append(chars.charAt(ThreadLocalRandom.current().nextInt(chars.length())));
        }
        return token.toString();
    }
}
