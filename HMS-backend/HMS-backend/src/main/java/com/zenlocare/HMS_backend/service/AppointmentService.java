package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.AppointmentDto;
import com.zenlocare.HMS_backend.dto.AppointmentRequest;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Service
@RequiredArgsConstructor
public class AppointmentService {

        private final AppointmentRepository appointmentRepository;
        private final HospitalRepository hospitalRepository;
        private final PatientRepository patientRepository;
        private final DoctorRepository doctorRepository;
        private final PriceListRepository priceListRepository;
        private final UserRepository userRepository;
        private final HealthCheckupService healthCheckupService;

        public List<AppointmentDto> getAppointmentsByHospital(UUID hospitalId, LocalDate date) {
                if (date != null) {
                        return appointmentRepository.findByHospitalIdAndApptDate(hospitalId, date).stream()
                                        .map(AppointmentDto::fromEntity)
                                        .collect(Collectors.toList());
                }
                return appointmentRepository.findByHospitalId(hospitalId).stream()
                                .map(AppointmentDto::fromEntity)
                                .collect(Collectors.toList());
        }

        public List<AppointmentDto> getAppointmentsByDoctor(UUID doctorId, LocalDate date) {
                return appointmentRepository.findByDoctorIdAndApptDate(doctorId, date).stream()
                                .map(AppointmentDto::fromEntity)
                                .collect(Collectors.toList());
        }

        public List<AppointmentDto> getAppointmentsByPatient(Integer patientId) {
                return appointmentRepository.findByPatientIdOrderByApptDateDescApptTimeDesc(patientId).stream()
                                .map(AppointmentDto::fromEntity)
                                .collect(Collectors.toList());
        }

        public List<AppointmentDto> getPastDoctorsForPatient(Integer patientId, UUID hospitalId) {
                return appointmentRepository.findDistinctDoctorsByPatient(patientId, hospitalId).stream()
                                .map(d -> AppointmentDto.builder()
                                                .doctorId(d.getId())
                                                .doctorName(d.getUser().getFirstName() + " " + d.getUser().getLastName())
                                                .doctorSpecialization(d.getSpecialization())
                                                .build())
                                .collect(Collectors.toList());
        }

        @Transactional
        public AppointmentDto createAppointment(AppointmentRequest request, UUID createdById) {
                Hospital hospital = hospitalRepository.findById(request.getHospitalId())
                                .orElseThrow(() -> new RuntimeException("Hospital not found"));

                // Resolve patient — create a minimal walk-in record for emergencies
                Patient patient;
                if (request.getPatientId() != null) {
                        patient = patientRepository.findById(request.getPatientId())
                                        .orElseThrow(() -> new RuntimeException("Patient not found"));
                } else if (request.getEmergencyPatientName() != null && !request.getEmergencyPatientName().isBlank()) {
                        String[] parts = request.getEmergencyPatientName().trim().split("\\s+", 2);
                        long count = patientRepository.countByHospitalId(hospital.getId());
                        String mrn = "MRN-" + String.format("%04d", count + 1);
                        patient = patientRepository.save(Patient.builder()
                                        .hospital(hospital)
                                        .mrn(mrn)
                                        .firstName(parts[0])
                                        .lastName(parts.length > 1 ? parts[1] : "—")
                                        .dob(LocalDate.now())
                                        .gender("U")
                                        .phone(request.getEmergencyPhone())
                                        .build());
                } else {
                        throw new RuntimeException("Patient is required");
                }

                // Doctor is optional for emergencies
                Doctor doctor = null;
                if (request.getDoctorId() != null) {
                        doctor = doctorRepository.findById(request.getDoctorId())
                                        .orElseThrow(() -> new RuntimeException("Doctor not found"));
                }

                User createdBy = userRepository.findById(createdById)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                PriceList priceList = null;
                if (request.getPriceListId() != null) {
                        priceList = priceListRepository.findById(request.getPriceListId())
                                        .orElseThrow(() -> new RuntimeException("Price List not found"));
                }

                LocalTime apptTime = request.getApptTime() != null ? request.getApptTime() : LocalTime.now().withSecond(0).withNano(0);
                LocalTime apptEndTime = doctor != null
                                ? apptTime.plusMinutes(doctor.getSlotDurationMin() != null ? doctor.getSlotDurationMin() : 15)
                                : apptTime.plusMinutes(15);

                // Check for slot collisions (only when doctor is assigned)
                if (doctor != null) {
                        long overlappingCount = appointmentRepository.countOverlappingAppointments(
                                        doctor.getId(), request.getApptDate(), apptTime, apptEndTime);
                        if (overlappingCount > 0) {
                                throw new RuntimeException("Slot collision detected for Doctor on the specified date and time.");
                        }
                }

                // Generate Token Number
                Integer currentTokens = doctor != null
                                ? appointmentRepository.countByDoctorIdAndApptDate(doctor.getId(), request.getApptDate())
                                : 0;
                int assignedToken = currentTokens + 1;

                // Auto-create checkup booking if a package is selected
                HealthCheckupBooking checkupBooking = null;
                if (request.getPackageId() != null) {
                        String creatorName = createdBy.getFirstName() + " " + createdBy.getLastName();
                        HealthCheckupService.BookingRequest br = new HealthCheckupService.BookingRequest();
                        br.setPatientId(request.getPatientId());
                        br.setPackageId(request.getPackageId());
                        br.setDoctorId(doctor.getId());
                        br.setScheduledDate(request.getApptDate().toString());
                        br.setScheduledTime(apptTime.toString());
                        br.setPaymentStatus("PENDING");
                        checkupBooking = healthCheckupService.createBooking(hospital.getId(), br, creatorName);
                }

                Appointment appointment = Appointment.builder()
                                .hospital(hospital)
                                .branchId(request.getBranchId())
                                .patient(patient)
                                .doctor(doctor)
                                .apptDate(request.getApptDate())
                                .apptTime(apptTime)
                                .apptEndTime(apptEndTime)
                                .type(request.getType() != null ? request.getType() : Appointment.AppointmentType.OPD)
                                .status(Appointment.AppointmentStatus.SCHEDULED)
                                .tokenNumber(assignedToken)
                                .chiefComplaint(request.getChiefComplaint())
                                .priceList(priceList)
                                .checkupBooking(checkupBooking)
                                .createdBy(createdBy)
                                .build();

                return AppointmentDto.fromEntity(appointmentRepository.save(appointment));
        }

        public AppointmentDto updateAppointmentStatus(UUID id, Appointment.AppointmentStatus status,
                        String cancelledReason) {
                Appointment appointment = appointmentRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                appointment.setStatus(status);
                if (status == Appointment.AppointmentStatus.CANCELLED) {
                        appointment.setCancelledReason(cancelledReason);
                }

                return AppointmentDto.fromEntity(appointmentRepository.save(appointment));
        }
}
