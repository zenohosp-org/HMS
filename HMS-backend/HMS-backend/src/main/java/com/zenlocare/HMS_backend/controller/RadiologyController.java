package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.CreateRadiologyOrderRequest;
import com.zenlocare.HMS_backend.dto.RadiologyOrderDTO;
import com.zenlocare.HMS_backend.dto.RadiologyReportRequest;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.service.RadiologyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/radiology")
@RequiredArgsConstructor
public class RadiologyController {

    private final RadiologyService radiologyService;

    @GetMapping
    public ResponseEntity<List<RadiologyOrderDTO>> getOrders(
            @RequestParam UUID hospitalId,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(radiologyService.getOrders(hospitalId, status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RadiologyOrderDTO> getOrder(@PathVariable Long id) {
        return ResponseEntity.ok(radiologyService.getOrder(id));
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<RadiologyOrderDTO>> getByPatient(@PathVariable Integer patientId) {
        return ResponseEntity.ok(radiologyService.getByPatient(patientId));
    }

    @GetMapping("/admission/{admissionId}")
    public ResponseEntity<List<RadiologyOrderDTO>> getByAdmission(@PathVariable UUID admissionId) {
        return ResponseEntity.ok(radiologyService.getByAdmission(admissionId));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(Map.of(
                "pendingScan",       radiologyService.countByStatus(hospitalId, "PENDING_SCAN"),
                "awaitingReport",    radiologyService.countByStatus(hospitalId, "AWAITING_REPORT"),
                "reportGenerated",   radiologyService.countByStatus(hospitalId, "REPORT_GENERATED")
        ));
    }

    @PostMapping
    public ResponseEntity<RadiologyOrderDTO> createOrder(
            @RequestBody CreateRadiologyOrderRequest request,
            Authentication auth) {
        return ResponseEntity.ok(radiologyService.createOrder(request, resolveFullName(auth)));
    }

    @PatchMapping("/{id}/scan")
    public ResponseEntity<RadiologyOrderDTO> markScanned(@PathVariable Long id) {
        return ResponseEntity.ok(radiologyService.markScanned(id));
    }

    @PatchMapping("/{id}/report")
    public ResponseEntity<RadiologyOrderDTO> generateReport(
            @PathVariable Long id,
            @RequestBody RadiologyReportRequest request) {
        return ResponseEntity.ok(radiologyService.generateReport(id, request));
    }

    private String resolveFullName(Authentication auth) {
        if (auth == null) return "System";
        try {
            User u = (User) auth.getPrincipal();
            String name = u.getFirstName();
            if (u.getLastName() != null) name += " " + u.getLastName();
            return name;
        } catch (Exception e) {
            return auth.getName();
        }
    }
}
