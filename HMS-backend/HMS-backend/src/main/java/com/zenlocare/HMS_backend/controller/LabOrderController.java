package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.Admission;
import com.zenlocare.HMS_backend.entity.LabOrder;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.exception.BadRequestException;
import com.zenlocare.HMS_backend.exception.ResourceNotFoundException;
import com.zenlocare.HMS_backend.exception.UnauthorizedException;
import com.zenlocare.HMS_backend.repository.AdmissionRepository;
import com.zenlocare.HMS_backend.repository.LabOrderRepository;
import com.zenlocare.HMS_backend.repository.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Lab order workflow for an IPD admission.
 *
 * GET    /api/ipd/lab-orders/{admissionId}                 — list orders
 * POST   /api/ipd/lab-orders/{admissionId}                 — create order
 * PATCH  /api/ipd/lab-orders/{admissionId}/{orderId}/collect — mark sample collected
 * PATCH  /api/ipd/lab-orders/{admissionId}/{orderId}/result  — enter result
 * DELETE /api/ipd/lab-orders/{admissionId}/{orderId}        — cancel (PENDING only)
 */
@RestController
@RequestMapping("/api/ipd/lab-orders/{admissionId}")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('doctor', 'staff', 'nurse', 'hospital_admin', 'super_admin')")
public class LabOrderController {

    private static final Set<String> VALID_PRIORITIES = Set.of("ROUTINE", "URGENT", "STAT");

    private final LabOrderRepository labOrderRepo;
    private final AdmissionRepository admissionRepo;
    private final UserRepository      userRepo;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<LabOrderDto>> list(
            @PathVariable UUID admissionId,
            @AuthenticationPrincipal User principal) {

        UUID hospitalId = resolveAndGuard(admissionId, principal);
        return ResponseEntity.ok(
            labOrderRepo.findByAdmissionIdAndHospitalIdOrderByCreatedAtDesc(admissionId, hospitalId)
                        .stream().map(this::toDto).toList()
        );
    }

    @PostMapping
    @Transactional
    public ResponseEntity<LabOrderDto> create(
            @PathVariable UUID admissionId,
            @RequestBody CreateLabOrderRequest req,
            @AuthenticationPrincipal User principal) {

        UUID hospitalId = resolveAndGuard(admissionId, principal);

        if (req.getTestName() == null || req.getTestName().isBlank())
            throw new BadRequestException("testName is required");

        String priority = req.getPriority() != null
                ? req.getPriority().trim().toUpperCase() : "ROUTINE";
        if (!VALID_PRIORITIES.contains(priority))
            throw new BadRequestException("priority must be ROUTINE, URGENT, or STAT");

        User orderer = resolveUser(principal);

        LabOrder order = LabOrder.builder()
                .admissionId(admissionId)
                .hospitalId(hospitalId)
                .testName(req.getTestName().trim())
                .testCode(req.getTestCode() != null && !req.getTestCode().isBlank()
                        ? req.getTestCode().trim() : null)
                .priority(priority)
                .orderedBy(orderer)
                .build();

        labOrderRepo.save(Objects.requireNonNull(order));
        return ResponseEntity.ok(toDto(order));
    }

    @PatchMapping("/{orderId}/collect")
    @Transactional
    public ResponseEntity<LabOrderDto> markCollected(
            @PathVariable UUID admissionId,
            @PathVariable UUID orderId,
            @AuthenticationPrincipal User principal) {

        UUID hospitalId = resolveAndGuard(admissionId, principal);
        LabOrder order = findOrder(orderId, hospitalId, admissionId);

        if ("RESULTED".equals(order.getStatus()))
            throw new BadRequestException("Order already resulted");
        if ("SAMPLE_COLLECTED".equals(order.getStatus()))
            throw new BadRequestException("Sample already marked as collected");

        User collector = resolveUser(principal);
        order.setStatus("SAMPLE_COLLECTED");
        order.setSampleCollectedAt(LocalDateTime.now());
        order.setSampleCollectedBy(collector);

        labOrderRepo.save(Objects.requireNonNull(order));
        return ResponseEntity.ok(toDto(order));
    }

    @PatchMapping("/{orderId}/result")
    @Transactional
    public ResponseEntity<LabOrderDto> enterResult(
            @PathVariable UUID admissionId,
            @PathVariable UUID orderId,
            @RequestBody ResultRequest req,
            @AuthenticationPrincipal User principal) {

        UUID hospitalId = resolveAndGuard(admissionId, principal);
        LabOrder order = findOrder(orderId, hospitalId, admissionId);

        if ("RESULTED".equals(order.getStatus()))
            throw new BadRequestException("Result already entered for this order");

        User resulter = resolveUser(principal);
        order.setStatus("RESULTED");
        order.setResultValue(req.getResultValue() != null && !req.getResultValue().isBlank()
                ? req.getResultValue().trim() : null);
        order.setResultUnit(req.getResultUnit() != null && !req.getResultUnit().isBlank()
                ? req.getResultUnit().trim() : null);
        order.setReferenceRange(req.getReferenceRange() != null && !req.getReferenceRange().isBlank()
                ? req.getReferenceRange().trim() : null);
        order.setResultNotes(req.getResultNotes() != null && !req.getResultNotes().isBlank()
                ? req.getResultNotes().trim() : null);
        order.setResultedAt(LocalDateTime.now());
        order.setResultedBy(resulter);

        labOrderRepo.save(Objects.requireNonNull(order));
        return ResponseEntity.ok(toDto(order));
    }

    @DeleteMapping("/{orderId}")
    @Transactional
    public ResponseEntity<Void> cancel(
            @PathVariable UUID admissionId,
            @PathVariable UUID orderId,
            @AuthenticationPrincipal User principal) {

        UUID hospitalId = resolveAndGuard(admissionId, principal);
        LabOrder order = findOrder(orderId, hospitalId, admissionId);

        if (!"PENDING".equals(order.getStatus()))
            throw new BadRequestException("Only PENDING orders can be cancelled");

        labOrderRepo.delete(order);
        return ResponseEntity.noContent().build();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private UUID resolveAndGuard(UUID admissionId, User principal) {
        User caller = resolveUser(principal);
        Admission admission = admissionRepo.findById(Objects.requireNonNull(admissionId))
                .orElseThrow(() -> new ResourceNotFoundException("Admission not found"));
        if (caller.getHospital() == null)
            throw new UnauthorizedException("No hospital associated with your account");
        if (!admission.getHospital().getId().equals(caller.getHospital().getId()))
            throw new UnauthorizedException("Access denied");
        return caller.getHospital().getId();
    }

    private User resolveUser(User principal) {
        return userRepo.findById(Objects.requireNonNull(principal.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private LabOrder findOrder(UUID orderId, UUID hospitalId, UUID admissionId) {
        LabOrder order = labOrderRepo.findByIdAndHospitalId(Objects.requireNonNull(orderId), hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Lab order not found"));
        if (!order.getAdmissionId().equals(admissionId))
            throw new BadRequestException("Order does not belong to this admission");
        return order;
    }

    private LabOrderDto toDto(LabOrder o) {
        LabOrderDto dto = new LabOrderDto();
        dto.setId(o.getId().toString());
        dto.setAdmissionId(o.getAdmissionId().toString());
        dto.setTestName(o.getTestName());
        dto.setTestCode(o.getTestCode());
        dto.setStatus(o.getStatus());
        dto.setPriority(o.getPriority());
        dto.setCreatedAt(o.getCreatedAt() != null ? o.getCreatedAt().toString() : null);
        if (o.getOrderedBy() != null)
            dto.setOrderedByName(fullName(o.getOrderedBy()));
        if (o.getSampleCollectedAt() != null)
            dto.setSampleCollectedAt(o.getSampleCollectedAt().toString());
        if (o.getSampleCollectedBy() != null)
            dto.setSampleCollectedByName(fullName(o.getSampleCollectedBy()));
        dto.setResultValue(o.getResultValue());
        dto.setResultUnit(o.getResultUnit());
        dto.setReferenceRange(o.getReferenceRange());
        dto.setResultNotes(o.getResultNotes());
        if (o.getResultedAt() != null)
            dto.setResultedAt(o.getResultedAt().toString());
        if (o.getResultedBy() != null)
            dto.setResultedByName(fullName(o.getResultedBy()));
        return dto;
    }

    private static String fullName(User u) {
        return u.getFirstName() + (u.getLastName() != null ? " " + u.getLastName() : "");
    }

    // ── Request / response types ──────────────────────────────────────────────

    @Data public static class CreateLabOrderRequest {
        private String testName;
        private String testCode;
        private String priority;
    }

    @Data public static class ResultRequest {
        private String resultValue;
        private String resultUnit;
        private String referenceRange;
        private String resultNotes;
    }

    @Data public static class LabOrderDto {
        private String id;
        private String admissionId;
        private String testName;
        private String testCode;
        private String status;
        private String priority;
        private String orderedByName;
        private String sampleCollectedAt;
        private String sampleCollectedByName;
        private String resultValue;
        private String resultUnit;
        private String referenceRange;
        private String resultNotes;
        private String resultedAt;
        private String resultedByName;
        private String createdAt;
    }
}
