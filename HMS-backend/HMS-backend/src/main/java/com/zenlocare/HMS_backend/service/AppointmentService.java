package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.AppointmentDto;
import com.zenlocare.HMS_backend.dto.AppointmentRequest;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Transactional(readOnly = true)
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
        private final InvoiceService invoiceService;

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

        public Page<AppointmentDto> getPaginatedAppointments(
                        UUID hospitalId,
                        UUID doctorId,
                        String dateFilter,
                        String search,
                        Pageable pageable) {
                LocalDate today = LocalDate.now();
                Page<Appointment> page = appointmentRepository.searchAppointments(
                                hospitalId,
                                doctorId,
                                dateFilter != null ? dateFilter.toUpperCase() : "ALL",
                                today,
                                search != null ? search : "",
                                pageable);
                return page.map(AppointmentDto::fromEntity);
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
                        // Tenant guard — patient must belong to the same hospital the
                        // appointment is being booked at; otherwise this is a cross-tenant
                        // read masquerading as a normal booking.
                        if (patient.getHospital() == null
                                        || !request.getHospitalId().equals(patient.getHospital().getId())) {
                                throw new RuntimeException("Patient does not belong to this hospital");
                        }
                } else if (request.getEmergencyPatientName() != null && !request.getEmergencyPatientName().isBlank()) {
                        String[] parts = request.getEmergencyPatientName().trim().split("\\s+", 2);
                        String uhid = generateUhid(hospital.getId());
                        patient = patientRepository.save(Patient.builder()
                                        .hospital(hospital)
                                        .uhid(uhid)
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
                        if (doctor.getHospital() == null
                                        || !request.getHospitalId().equals(doctor.getHospital().getId())) {
                                throw new RuntimeException("Doctor does not belong to this hospital");
                        }
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

                // Token number is NOT assigned at creation — the appointment starts in
                // SCHEDULED with a null token. A token is allocated only when the front
                // desk advances the status to CONFIRMED (or beyond) and the appointment
                // is for today; see {@link #updateAppointmentStatus}. This keeps the
                // hospital's today-queue dense and sequential (1..100) instead of
                // gapped by no-shows or future bookings.

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
                                .chiefComplaint(request.getChiefComplaint())
                                .priceList(priceList)
                                .checkupBooking(checkupBooking)
                                .createdBy(createdBy)
                                .build();

                return AppointmentDto.fromEntity(appointmentRepository.save(appointment));
        }

        private String generateUhid(UUID hospitalId) {
                String uhid;
                do {
                        long value = 10_000_000_000_000L +
                                        ThreadLocalRandom.current().nextLong(90_000_000_000_000L);
                        uhid = String.valueOf(value);
                } while (patientRepository.findByHospitalIdAndUhid(hospitalId, uhid).isPresent());
                return uhid;
        }

        // Statuses that occupy a slot in the day's token queue. Anything outside
        // this set (SCHEDULED / CANCELLED / NO_SHOW) holds no token.
        private static final java.util.Set<Appointment.AppointmentStatus> TOKEN_ELIGIBLE_STATUSES =
                        java.util.EnumSet.of(
                                        Appointment.AppointmentStatus.CONFIRMED,
                                        Appointment.AppointmentStatus.CHECKED_IN,
                                        Appointment.AppointmentStatus.IN_PROGRESS,
                                        Appointment.AppointmentStatus.COMPLETED,
                                        Appointment.AppointmentStatus.BILLED);

        private static final int TOKEN_CAP_PER_DAY = 100;

        @Transactional
        public AppointmentDto updateAppointmentStatus(UUID id, Appointment.AppointmentStatus status,
                        String cancelledReason) {
                // findByIdWithRelations hydrates patient + doctor.user + createdBy + hospital
                // up-front so the DTO mapper below (and any downstream listeners) never
                // hit a LazyInit/Role proxy if Hibernate auto-flushes between the read
                // and the save.
                Appointment appointment = appointmentRepository.findByIdWithRelations(id)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                appointment.setStatus(status);
                if (status == Appointment.AppointmentStatus.CANCELLED) {
                        appointment.setCancelledReason(cancelledReason);
                }

                // Token lifecycle:
                //   - Becoming queue-eligible (CONFIRMED/CHECKED_IN/IN_PROGRESS/COMPLETED/BILLED)
                //     and no token yet → assign next free number in THAT appointment's
                //     apptDate queue (1..100). Each apptDate is its own 1..100 sequence,
                //     so a CONFIRMED appointment booked today for tomorrow gets a token
                //     in tomorrow's queue, not today's.
                //   - Leaving the queue (SCHEDULED via reschedule, CANCELLED, NO_SHOW) → release
                //     the number so it doesn't dangle on a no-longer-active row.
                //   The cap is enforced at allocation time; over-cap requests get a null token
                //   (caller can run "Refresh Tokens" to renumber if real demand exceeds 100).
                if (TOKEN_ELIGIBLE_STATUSES.contains(status)) {
                        if (appointment.getTokenNumber() == null) {
                                LocalDate apptDate = appointment.getApptDate();
                                Integer maxToken = appointmentRepository
                                                .findMaxTokenNumberByHospitalIdAndApptDate(
                                                                appointment.getHospital().getId(), apptDate);
                                int next = (maxToken == null ? 0 : maxToken) + 1;
                                if (next <= TOKEN_CAP_PER_DAY) {
                                        appointment.setTokenNumber(next);
                                }
                        }
                } else {
                        // SCHEDULED / CANCELLED / NO_SHOW → release token if held
                        appointment.setTokenNumber(null);
                }

                AppointmentDto result = AppointmentDto.fromEntity(appointmentRepository.save(appointment));

                // CONFIRMED → create invoice with consultation fee immediately
                // CANCELLED → remove consultation item; delete invoice if it becomes empty
                if (status == Appointment.AppointmentStatus.CONFIRMED) {
                        try { invoiceService.createAppointmentInvoice(id, true); } catch (Exception ignored) {}
                } else if (status == Appointment.AppointmentStatus.CANCELLED) {
                        try { invoiceService.cancelAppointmentInvoice(id); } catch (Exception ignored) {}
                }

                return result;
        }

        /**
         * Reset and re-number the entire today-queue for a hospital. Walks all of
         * today's appointments in createdAt order, assigning 1..N to the token-
         * eligible ones (CONFIRMED+) and clearing any token off the ineligible
         * ones (SCHEDULED / CANCELLED / NO_SHOW). Useful after a busy morning
         * where the natural confirmation order doesn't match arrival order any
         * more — one click puts the queue back in chronological sequence.
         */
        @Transactional
        public int refreshTokensForToday(UUID hospitalId) {
                LocalDate today = LocalDate.now();
                List<Appointment> todays = appointmentRepository
                                .findByHospitalIdAndApptDateOrderByCreatedAtAsc(hospitalId, today);

                int counter = 1;
                int assigned = 0;
                for (Appointment a : todays) {
                        if (TOKEN_ELIGIBLE_STATUSES.contains(a.getStatus()) && counter <= TOKEN_CAP_PER_DAY) {
                                a.setTokenNumber(counter++);
                                assigned++;
                        } else {
                                a.setTokenNumber(null);
                        }
                }
                appointmentRepository.saveAll(todays);
                return assigned;
        }
}
