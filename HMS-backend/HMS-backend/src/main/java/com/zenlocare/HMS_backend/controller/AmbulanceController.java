package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
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
    private final AmbulanceVehicleRepository vehicleRepo;
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

    // ── Vehicles ──────────────────────────────────────────────────────────

    @GetMapping("/vehicles")
    public ResponseEntity<List<AmbulanceVehicle>> getVehicles(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(vehicleRepo.findByHospital_IdOrderByCreatedAtDesc(hospitalId));
    }

    @GetMapping("/vehicles/available")
    public ResponseEntity<List<AmbulanceVehicle>> getAvailableVehicles(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(vehicleRepo.findByHospital_IdAndStatusOrderByVehicleNumberAsc(hospitalId, AmbulanceVehicleStatus.AVAILABLE));
    }

    @PostMapping("/vehicles")
    public ResponseEntity<AmbulanceVehicle> createVehicle(@RequestParam UUID hospitalId,
                                                           @RequestBody VehicleRequest req) {
        Hospital hospital = hospitalRepo.getReferenceById(hospitalId);
        AmbulanceType type = req.getAmbulanceTypeId() != null
                ? typeRepo.findById(req.getAmbulanceTypeId()).orElse(null) : null;
        AmbulanceVehicle vehicle = AmbulanceVehicle.builder()
                .hospital(hospital)
                .vehicleNumber(req.getVehicleNumber())
                .vehicleName(req.getVehicleName())
                .ambulanceType(type)
                .defaultCharge(req.getDefaultCharge())
                .status(AmbulanceVehicleStatus.AVAILABLE)
                .notes(req.getNotes())
                .build();
        return ResponseEntity.ok(vehicleRepo.save(vehicle));
    }

    @PutMapping("/vehicles/{id}")
    public ResponseEntity<AmbulanceVehicle> updateVehicle(@PathVariable Long id,
                                                           @RequestBody VehicleRequest req) {
        return vehicleRepo.findById(id).map(v -> {
            AmbulanceType type = req.getAmbulanceTypeId() != null
                    ? typeRepo.findById(req.getAmbulanceTypeId()).orElse(null) : null;
            v.setVehicleNumber(req.getVehicleNumber());
            v.setVehicleName(req.getVehicleName());
            v.setAmbulanceType(type);
            v.setDefaultCharge(req.getDefaultCharge());
            v.setNotes(req.getNotes());
            return ResponseEntity.ok(vehicleRepo.save(v));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/vehicles/{id}/status")
    public ResponseEntity<AmbulanceVehicle> updateVehicleStatus(@PathVariable Long id,
                                                                  @RequestBody Map<String, String> body) {
        return vehicleRepo.findById(id).map(v -> {
            v.setStatus(AmbulanceVehicleStatus.valueOf(body.get("status")));
            return ResponseEntity.ok(vehicleRepo.save(v));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/vehicles/{id}")
    public ResponseEntity<Void> deleteVehicle(@PathVariable Long id) {
        vehicleRepo.deleteById(id);
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
        AmbulanceVehicle vehicle = req.getVehicleId() != null ? vehicleRepo.findById(req.getVehicleId()).orElse(null) : null;

        BigDecimal charge = req.getCharge() != null ? req.getCharge()
                : (vehicle != null ? vehicle.getDefaultCharge() : null);
        String vehicleNumber = vehicle != null ? vehicle.getVehicleNumber() : req.getVehicleNumber();
        if (type == null && vehicle != null) type = vehicle.getAmbulanceType();

        AmbulanceBooking booking = AmbulanceBooking.builder()
                .hospital(hospital)
                .patient(patient)
                .bookingDate(LocalDate.parse(req.getBookingDate()))
                .bookingTime(LocalTime.parse(req.getBookingTime()))
                .pickupAddress(req.getPickupAddress())
                .destinationAddress(req.getDestinationAddress())
                .ambulanceType(type)
                .vehicle(vehicle)
                .charge(charge)
                .paymentStatus(req.getPaymentStatus() != null ? req.getPaymentStatus() : "UNPAID")
                .status(AmbulanceBookingStatus.PENDING)
                .driverName(req.getDriverName())
                .driverPhone(req.getDriverPhone())
                .vehicleNumber(vehicleNumber)
                .notes(req.getNotes())
                .build();

        return ResponseEntity.ok(bookingRepo.save(booking));
    }

    @Transactional
    @PatchMapping("/bookings/{id}/status")
    public ResponseEntity<AmbulanceBooking> updateStatus(@PathVariable Long id,
                                                          @RequestBody Map<String, String> body) {
        return bookingRepo.findById(id).map(b -> {
            AmbulanceBookingStatus newStatus = AmbulanceBookingStatus.valueOf(body.get("status"));
            b.setStatus(newStatus);
            if (body.containsKey("paymentStatus")) b.setPaymentStatus(body.get("paymentStatus"));

            if (b.getVehicle() != null) {
                if (newStatus == AmbulanceBookingStatus.DISPATCHED || newStatus == AmbulanceBookingStatus.EN_ROUTE) {
                    b.getVehicle().setStatus(AmbulanceVehicleStatus.IN_USE);
                    vehicleRepo.save(b.getVehicle());
                } else if (newStatus == AmbulanceBookingStatus.COMPLETED || newStatus == AmbulanceBookingStatus.CANCELLED) {
                    b.getVehicle().setStatus(AmbulanceVehicleStatus.AVAILABLE);
                    vehicleRepo.save(b.getVehicle());
                }
            }

            return ResponseEntity.ok(bookingRepo.save(b));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/bookings/{id}")
    public ResponseEntity<AmbulanceBooking> updateBooking(@PathVariable Long id,
                                                           @RequestBody BookingRequest req) {
        return bookingRepo.findById(id).map(b -> {
            if (req.getPatientId() != null) b.setPatient(patientRepo.findById(req.getPatientId()).orElse(null));
            if (req.getAmbulanceTypeId() != null) b.setAmbulanceType(typeRepo.findById(req.getAmbulanceTypeId()).orElse(null));
            if (req.getVehicleId() != null) {
                AmbulanceVehicle v = vehicleRepo.findById(req.getVehicleId()).orElse(null);
                b.setVehicle(v);
                if (v != null) b.setVehicleNumber(v.getVehicleNumber());
            }
            if (req.getBookingDate() != null) b.setBookingDate(LocalDate.parse(req.getBookingDate()));
            if (req.getBookingTime() != null) b.setBookingTime(LocalTime.parse(req.getBookingTime()));
            b.setPickupAddress(req.getPickupAddress());
            b.setDestinationAddress(req.getDestinationAddress());
            b.setCharge(req.getCharge());
            if (req.getPaymentStatus() != null) b.setPaymentStatus(req.getPaymentStatus());
            if (req.getStatus() != null) b.setStatus(AmbulanceBookingStatus.valueOf(req.getStatus()));
            b.setDriverName(req.getDriverName());
            b.setDriverPhone(req.getDriverPhone());
            if (req.getVehicleId() == null && req.getVehicleNumber() != null) b.setVehicleNumber(req.getVehicleNumber());
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
    public static class VehicleRequest {
        private String vehicleNumber;
        private String vehicleName;
        private Long ambulanceTypeId;
        private BigDecimal defaultCharge;
        private String notes;
    }

    @Data
    public static class BookingRequest {
        private Integer patientId;
        private String bookingDate;
        private String bookingTime;
        private String pickupAddress;
        private String destinationAddress;
        private Long ambulanceTypeId;
        private Long vehicleId;
        private BigDecimal charge;
        private String paymentStatus;
        private String status;
        private String driverName;
        private String driverPhone;
        private String vehicleNumber;
        private String notes;
    }
}
