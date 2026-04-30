package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ambulance")
@RequiredArgsConstructor
public class AmbulanceController {

    private final AmbulanceBookingRepository bookingRepo;
    private final AmbulanceTypeRepository typeRepo;
    private final HospitalRepository hospitalRepo;
    private final PatientRepository patientRepo;

    // ── Types ──────────────────────────────────────────────────────────────

    @GetMapping("/types")
    public ResponseEntity<List<AmbulanceType>> getTypes(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(typeRepo.findByHospitalIdAndActiveTrue(hospitalId));
    }

    @PostMapping("/types")
    public ResponseEntity<AmbulanceType> createType(@RequestParam UUID hospitalId,
                                                     @RequestBody TypeRequest req) {
        AmbulanceType type = AmbulanceType.builder()
                .hospitalId(hospitalId)
                .name(req.getName())
                .defaultCharge(req.getDefaultCharge())
                .active(true)
                .build();
        return ResponseEntity.ok(typeRepo.save(type));
    }

    @DeleteMapping("/types/{id}")
    public ResponseEntity<Void> deleteType(@PathVariable Long id) {
        typeRepo.findById(id).ifPresent(t -> {
            t.setActive(false);
            typeRepo.save(t);
        });
        return ResponseEntity.ok().build();
    }

    // ── Bookings ──────────────────────────────────────────────────────────

    @GetMapping("/bookings")
    public ResponseEntity<List<AmbulanceBooking>> getBookings(
            @RequestParam UUID hospitalId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String date) {
        if (status != null && !status.isEmpty()) {
            return ResponseEntity.ok(bookingRepo.findByHospital_IdAndStatusOrderByCreatedAtDesc(
                    hospitalId, AmbulanceBookingStatus.valueOf(status)));
        }
        if (date != null && !date.isEmpty()) {
            return ResponseEntity.ok(bookingRepo.findByHospital_IdAndBookingDateOrderByBookingTimeAsc(
                    hospitalId, LocalDate.parse(date)));
        }
        return ResponseEntity.ok(bookingRepo.findByHospital_IdOrderByCreatedAtDesc(hospitalId));
    }

    @PostMapping("/bookings")
    public ResponseEntity<AmbulanceBooking> createBooking(@RequestParam UUID hospitalId,
                                                           @RequestBody BookingRequest req) {
        Hospital hospital = hospitalRepo.getReferenceById(hospitalId);
        Patient patient = req.getPatientId() != null ? patientRepo.findById(req.getPatientId()).orElse(null) : null;
        AmbulanceType type = req.getAmbulanceTypeId() != null ? typeRepo.findById(req.getAmbulanceTypeId()).orElse(null) : null;

        AmbulanceBooking booking = AmbulanceBooking.builder()
                .hospital(hospital)
                .patient(patient)
                .bookingDate(LocalDate.parse(req.getBookingDate()))
                .bookingTime(LocalTime.parse(req.getBookingTime()))
                .pickupAddress(req.getPickupAddress())
                .destinationAddress(req.getDestinationAddress())
                .ambulanceType(type)
                .charge(req.getCharge())
                .paymentStatus(req.getPaymentStatus() != null ? req.getPaymentStatus() : "UNPAID")
                .status(AmbulanceBookingStatus.PENDING)
                .driverName(req.getDriverName())
                .driverPhone(req.getDriverPhone())
                .vehicleNumber(req.getVehicleNumber())
                .notes(req.getNotes())
                .build();

        return ResponseEntity.ok(bookingRepo.save(booking));
    }

    @PatchMapping("/bookings/{id}/status")
    public ResponseEntity<AmbulanceBooking> updateStatus(@PathVariable Long id,
                                                          @RequestBody Map<String, String> body) {
        return bookingRepo.findById(id).map(b -> {
            b.setStatus(AmbulanceBookingStatus.valueOf(body.get("status")));
            if (body.containsKey("paymentStatus")) b.setPaymentStatus(body.get("paymentStatus"));
            return ResponseEntity.ok(bookingRepo.save(b));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/bookings/{id}")
    public ResponseEntity<AmbulanceBooking> updateBooking(@PathVariable Long id,
                                                           @RequestBody BookingRequest req) {
        return bookingRepo.findById(id).map(b -> {
            if (req.getPatientId() != null) b.setPatient(patientRepo.findById(req.getPatientId()).orElse(null));
            if (req.getAmbulanceTypeId() != null) b.setAmbulanceType(typeRepo.findById(req.getAmbulanceTypeId()).orElse(null));
            if (req.getBookingDate() != null) b.setBookingDate(LocalDate.parse(req.getBookingDate()));
            if (req.getBookingTime() != null) b.setBookingTime(LocalTime.parse(req.getBookingTime()));
            b.setPickupAddress(req.getPickupAddress());
            b.setDestinationAddress(req.getDestinationAddress());
            b.setCharge(req.getCharge());
            if (req.getPaymentStatus() != null) b.setPaymentStatus(req.getPaymentStatus());
            if (req.getStatus() != null) b.setStatus(AmbulanceBookingStatus.valueOf(req.getStatus()));
            b.setDriverName(req.getDriverName());
            b.setDriverPhone(req.getDriverPhone());
            b.setVehicleNumber(req.getVehicleNumber());
            b.setNotes(req.getNotes());
            return ResponseEntity.ok(bookingRepo.save(b));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/bookings/{id}")
    public ResponseEntity<Void> deleteBooking(@PathVariable Long id) {
        bookingRepo.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats(@RequestParam UUID hospitalId) {
        long total = bookingRepo.findByHospital_IdOrderByCreatedAtDesc(hospitalId).size();
        long pending = bookingRepo.countByHospital_IdAndStatus(hospitalId, AmbulanceBookingStatus.PENDING);
        long today = bookingRepo.countByHospitalIdAndDate(hospitalId, LocalDate.now());
        long completed = bookingRepo.countByHospital_IdAndStatus(hospitalId, AmbulanceBookingStatus.COMPLETED);
        return ResponseEntity.ok(Map.of("total", total, "pending", pending, "today", today, "completed", completed));
    }

    // ── DTOs ──────────────────────────────────────────────────────────────

    @Data
    public static class TypeRequest {
        private String name;
        private BigDecimal defaultCharge;
    }

    @Data
    public static class BookingRequest {
        private Integer patientId;
        private String bookingDate;
        private String bookingTime;
        private String pickupAddress;
        private String destinationAddress;
        private Long ambulanceTypeId;
        private BigDecimal charge;
        private String paymentStatus;
        private String status;
        private String driverName;
        private String driverPhone;
        private String vehicleNumber;
        private String notes;
    }
}
