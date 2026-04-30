package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.HealthCheckupBooking;
import com.zenlocare.HMS_backend.entity.HealthPackage;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.service.HealthCheckupService;
import com.zenlocare.HMS_backend.service.HealthCheckupService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/health-checkups")
@RequiredArgsConstructor
public class HealthCheckupController {

    private final HealthCheckupService service;

    // ── Packages ──────────────────────────────────────────────────────────

    @GetMapping("/packages")
    public ResponseEntity<List<HealthPackage>> getPackages(
            @RequestParam UUID hospitalId,
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(service.getPackages(hospitalId, activeOnly));
    }

    @PostMapping("/packages")
    @PreAuthorize("hasAnyRole('hospital_admin', 'super_admin')")
    public ResponseEntity<HealthPackage> savePackage(
            @RequestParam UUID hospitalId,
            @RequestBody PackageRequest req) {
        return ResponseEntity.ok(service.savePackage(hospitalId, req));
    }

    @PatchMapping("/packages/{id}/toggle")
    @PreAuthorize("hasAnyRole('hospital_admin', 'super_admin')")
    public ResponseEntity<Void> togglePackage(@PathVariable UUID id) {
        service.togglePackage(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/packages/{id}")
    @PreAuthorize("hasAnyRole('hospital_admin', 'super_admin')")
    public ResponseEntity<Void> deletePackage(@PathVariable UUID id) {
        service.deletePackage(id);
        return ResponseEntity.ok().build();
    }

    // ── Bookings ──────────────────────────────────────────────────────────

    @GetMapping("/bookings")
    public ResponseEntity<List<HealthCheckupBooking>> getBookings(
            @RequestParam UUID hospitalId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String date) {
        return ResponseEntity.ok(service.getBookings(hospitalId, status, date));
    }

    @GetMapping("/bookings/{id}")
    public ResponseEntity<HealthCheckupBooking> getBooking(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getBooking(id));
    }

    @PostMapping("/bookings")
    public ResponseEntity<HealthCheckupBooking> createBooking(
            @RequestParam UUID hospitalId,
            @RequestBody BookingRequest req,
            Authentication auth) {
        return ResponseEntity.ok(service.createBooking(hospitalId, req, resolveFullName(auth)));
    }

    @PatchMapping("/bookings/{id}/status")
    public ResponseEntity<HealthCheckupBooking> updateStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(service.updateStatus(id, body.get("status")));
    }

    @PatchMapping("/bookings/{id}/results/{resultId}")
    public ResponseEntity<HealthCheckupBooking> updateResult(
            @PathVariable UUID id,
            @PathVariable Long resultId,
            @RequestBody ResultUpdateRequest req) {
        return ResponseEntity.ok(service.updateResult(id, resultId, req));
    }

    @PatchMapping("/bookings/{id}/doctor-notes")
    public ResponseEntity<HealthCheckupBooking> saveDoctorNotes(
            @PathVariable UUID id,
            @RequestBody DoctorNotesRequest req) {
        return ResponseEntity.ok(service.saveDoctorNotes(id, req));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(service.getStats(hospitalId));
    }

    private String resolveFullName(Authentication auth) {
        if (auth != null && auth.getPrincipal() instanceof User u)
            return u.getFirstName() + " " + u.getLastName();
        return "System";
    }
}
