package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HealthCheckupService {

    private final HealthPackageRepository packageRepo;
    private final HealthCheckupBookingRepository bookingRepo;
    private final HospitalRepository hospitalRepo;
    private final PatientRepository patientRepo;
    private final DoctorRepository doctorRepo;

    // ── Package management ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HealthPackage> getPackages(UUID hospitalId, boolean activeOnly) {
        return activeOnly
                ? packageRepo.findActiveByHospitalId(hospitalId)
                : packageRepo.findByHospitalId(hospitalId);
    }

    @Transactional
    public HealthPackage savePackage(UUID hospitalId, PackageRequest req) {
        Hospital hospital = hospitalRepo.getReferenceById(hospitalId);
        HealthPackage pkg = req.getId() != null
                ? packageRepo.findById(req.getId()).orElse(new HealthPackage())
                : new HealthPackage();

        pkg.setHospital(hospital);
        pkg.setName(req.getName());
        pkg.setDescription(req.getDescription());
        pkg.setCategory(PackageCategory.valueOf(req.getCategory()));
        pkg.setTargetGender(req.getTargetGender() != null ? req.getTargetGender() : "ANY");
        pkg.setPrice(req.getPrice());
        pkg.setValidityDays(req.getValidityDays() != null ? req.getValidityDays() : 1);
        pkg.setActive(req.isActive());

        pkg.getTests().clear();
        if (req.getTests() != null) {
            for (int i = 0; i < req.getTests().size(); i++) {
                TestRequest t = req.getTests().get(i);
                HealthPackageTest test = HealthPackageTest.builder()
                        .healthPackage(pkg)
                        .testName(t.getTestName())
                        .testCategory(t.getTestCategory() != null ? t.getTestCategory() : "GENERAL")
                        .normalRange(t.getNormalRange())
                        .displayOrder(i)
                        .mandatory(t.isMandatory())
                        .build();
                pkg.getTests().add(test);
            }
        }

        return packageRepo.save(pkg);
    }

    @Transactional
    public void togglePackage(UUID packageId) {
        packageRepo.findById(packageId).ifPresent(p -> {
            p.setActive(!p.isActive());
            packageRepo.save(p);
        });
    }

    @Transactional
    public void deletePackage(UUID packageId) {
        packageRepo.deleteById(packageId);
    }

    // ── Bookings ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HealthCheckupBooking> getBookings(UUID hospitalId, String status, String date) {
        if (status != null && !status.isBlank()) {
            return bookingRepo.findByHospital_IdAndStatusOrderByScheduledDateDesc(
                    hospitalId, CheckupBookingStatus.valueOf(status));
        }
        if (date != null && !date.isBlank()) {
            return bookingRepo.findByHospital_IdAndScheduledDateOrderByScheduledTimeAsc(
                    hospitalId, LocalDate.parse(date));
        }
        return bookingRepo.findByHospital_IdOrderByScheduledDateDescCreatedAtDesc(hospitalId);
    }

    @Transactional(readOnly = true)
    public HealthCheckupBooking getBooking(UUID bookingId) {
        return bookingRepo.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
    }

    @Transactional
    public HealthCheckupBooking createBooking(UUID hospitalId, BookingRequest req, String performedBy) {
        Hospital hospital = hospitalRepo.getReferenceById(hospitalId);
        Patient patient = patientRepo.findById(req.getPatientId())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found"));
        HealthPackage pkg = packageRepo.findById(req.getPackageId())
                .orElseThrow(() -> new IllegalArgumentException("Package not found"));
        Doctor doctor = req.getDoctorId() != null ? doctorRepo.findById(req.getDoctorId()).orElse(null) : null;

        String bookingNumber = generateBookingNumber(hospitalId);

        HealthCheckupBooking booking = HealthCheckupBooking.builder()
                .hospital(hospital)
                .patient(patient)
                .healthPackage(pkg)
                .assignedDoctor(doctor)
                .bookingNumber(bookingNumber)
                .scheduledDate(LocalDate.parse(req.getScheduledDate()))
                .scheduledTime(req.getScheduledTime() != null ? LocalTime.parse(req.getScheduledTime()) : null)
                .status(CheckupBookingStatus.SCHEDULED)
                .paymentStatus(req.getPaymentStatus() != null ? req.getPaymentStatus() : "PENDING")
                .amountPaid(req.getAmountPaid() != null ? req.getAmountPaid() : java.math.BigDecimal.ZERO)
                .notes(req.getNotes())
                .createdBy(performedBy)
                .build();

        // Auto-create one result row per test in the package
        for (HealthPackageTest t : pkg.getTests()) {
            booking.getResults().add(HealthCheckupResult.builder()
                    .booking(booking)
                    .testName(t.getTestName())
                    .testCategory(t.getTestCategory())
                    .normalRange(t.getNormalRange())
                    .displayOrder(t.getDisplayOrder())
                    .mandatory(t.isMandatory())
                    .resultStatus("PENDING")
                    .build());
        }

        return bookingRepo.save(booking);
    }

    @Transactional
    public HealthCheckupBooking updateStatus(UUID bookingId, String status) {
        HealthCheckupBooking booking = bookingRepo.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        booking.setStatus(CheckupBookingStatus.valueOf(status));
        return bookingRepo.save(booking);
    }

    @Transactional
    public HealthCheckupBooking updateResult(UUID bookingId, Long resultId, ResultUpdateRequest req) {
        HealthCheckupBooking booking = bookingRepo.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        booking.getResults().stream()
                .filter(r -> r.getId().equals(resultId))
                .findFirst()
                .ifPresent(r -> {
                    r.setResultValue(req.getResultValue());
                    r.setResultStatus(req.getResultStatus() != null ? req.getResultStatus() : "COMPLETED");
                    r.setResultNotes(req.getResultNotes());
                    if ("COMPLETED".equals(r.getResultStatus())) r.setCompletedAt(LocalDateTime.now());
                });

        // Auto-advance status to IN_PROGRESS when first result is entered
        if (booking.getStatus() == CheckupBookingStatus.CHECKED_IN ||
                booking.getStatus() == CheckupBookingStatus.SCHEDULED) {
            booking.setStatus(CheckupBookingStatus.IN_PROGRESS);
        }

        return bookingRepo.save(booking);
    }

    @Transactional
    public HealthCheckupBooking saveDoctorNotes(UUID bookingId, DoctorNotesRequest req) {
        HealthCheckupBooking booking = bookingRepo.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        booking.setDoctorNotes(req.getDoctorNotes());
        booking.setRecommendation(req.getRecommendation());
        return bookingRepo.save(booking);
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, Long> getStats(UUID hospitalId) {
        long total = bookingRepo.countByHospital_IdAndScheduledDate(hospitalId, LocalDate.now());
        long scheduled = bookingRepo.countByHospital_IdAndStatus(hospitalId, CheckupBookingStatus.SCHEDULED);
        long inProgress = bookingRepo.countByHospital_IdAndStatus(hospitalId, CheckupBookingStatus.IN_PROGRESS);
        long completed = bookingRepo.countByHospital_IdAndStatus(hospitalId, CheckupBookingStatus.COMPLETED);
        return java.util.Map.of("today", total, "scheduled", scheduled, "inProgress", inProgress, "completed", completed);
    }

    private String generateBookingNumber(UUID hospitalId) {
        String year = String.valueOf(LocalDate.now().getYear());
        String prefix = "HCP-" + year + "-";
        return bookingRepo.findMaxBookingNumberForYear(hospitalId, year)
                .filter(max -> max != null)
                .map(max -> {
                    int seq = Integer.parseInt(max.replace(prefix, "")) + 1;
                    return prefix + String.format("%04d", seq);
                })
                .orElse(prefix + "0001");
    }

    // ── Request DTOs ──────────────────────────────────────────────────────

    @lombok.Data
    public static class PackageRequest {
        private UUID id;
        private String name;
        private String description;
        private String category;
        private String targetGender;
        private java.math.BigDecimal price;
        private Integer validityDays;
        private boolean active = true;
        private List<TestRequest> tests;
    }

    @lombok.Data
    public static class TestRequest {
        private String testName;
        private String testCategory;
        private String normalRange;
        private boolean mandatory = true;
    }

    @lombok.Data
    public static class BookingRequest {
        private Integer patientId;
        private UUID packageId;
        private UUID doctorId;
        private String scheduledDate;
        private String scheduledTime;
        private String paymentStatus;
        private java.math.BigDecimal amountPaid;
        private String notes;
    }

    @lombok.Data
    public static class ResultUpdateRequest {
        private String resultValue;
        private String resultStatus;
        private String resultNotes;
    }

    @lombok.Data
    public static class DoctorNotesRequest {
        private String doctorNotes;
        private String recommendation;
    }
}
