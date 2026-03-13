package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.AppointmentDto;
import com.zenlocare.HMS_backend.dto.AppointmentRequest;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AppointmentService {

        private final AppointmentRepository appointmentRepository;
        private final HospitalRepository hospitalRepository;
        private final PatientRepository patientRepository;
        private final DoctorRepository doctorRepository;
        private final PriceListRepository priceListRepository;
        private final UserRepository userRepository;

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

        public AppointmentDto createAppointment(AppointmentRequest request, UUID createdById) {
                Hospital hospital = hospitalRepository.findById(request.getHospitalId())
                                .orElseThrow(() -> new RuntimeException("Hospital not found"));

                Patient patient = patientRepository.findById(request.getPatientId())
                                .orElseThrow(() -> new RuntimeException("Patient not found"));

                Doctor doctor = doctorRepository.findById(request.getDoctorId())
                                .orElseThrow(() -> new RuntimeException("Doctor not found"));

                User createdBy = userRepository.findById(createdById)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                PriceList priceList = null;
                if (request.getPriceListId() != null) {
                        priceList = priceListRepository.findById(request.getPriceListId())
                                        .orElseThrow(() -> new RuntimeException("Price List not found"));
                }

                LocalTime apptTime = request.getApptTime();
                LocalTime apptEndTime = apptTime
                                .plusMinutes(doctor.getSlotDurationMin() != null ? doctor.getSlotDurationMin() : 15);

                // Check for slot collisions
                long overlappingCount = appointmentRepository.countOverlappingAppointments(
                                doctor.getId(), request.getApptDate(), apptTime, apptEndTime);

                if (overlappingCount > 0) {
                        throw new RuntimeException(
                                        "Slot collision detected for Doctor on the specified date and time.");
                }

                // Generate Token Number
                Integer currentTokens = appointmentRepository.countByDoctorIdAndApptDate(doctor.getId(),
                                request.getApptDate());
                int assignedToken = currentTokens + 1;

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
