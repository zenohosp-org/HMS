package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.MedicationAdministration;
import com.zenlocare.HMS_backend.entity.PrescriptionItem;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.exception.BadRequestException;
import com.zenlocare.HMS_backend.exception.ResourceNotFoundException;
import com.zenlocare.HMS_backend.exception.UnauthorizedException;
import com.zenlocare.HMS_backend.repository.AdmissionRepository;
import com.zenlocare.HMS_backend.repository.MedicationAdministrationRepository;
import com.zenlocare.HMS_backend.repository.PrescriptionItemRepository;
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
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Medication Administration Record (MAR) endpoints for IPD admissions.
 *
 * GET  /api/ipd/mar/admission/{admissionId}
 *   Returns every prescription order for the admission as an OrderCardDto, each
 *   with its embedded list of administration events (chronological, oldest-first).
 *   Two queries — one for orders (prescription_items JOIN patient_records),
 *   one for admin rows — joined in Java by orderId so the SQL stays simple.
 *
 * POST /api/ipd/mar
 *   Logs one administration event against an existing prescription order.
 *   status must be GIVEN, HELD, or REFUSED. reason is required for HELD/REFUSED.
 *   hospital_id, patient_id, and admission_id are always derived server-side from
 *   the admission entity; they are never accepted from the request body.
 */
@RestController
@RequestMapping("/api/ipd/mar")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('doctor', 'staff', 'hospital_admin', 'super_admin')")
public class MedicationAdministrationController {

    private static final Set<String> VALID_STATUSES = Set.of("GIVEN", "HELD", "REFUSED");

    private final MedicationAdministrationRepository medAdminRepo;
    private final PrescriptionItemRepository         prescriptionItemRepo;
    private final AdmissionRepository                admissionRepo;
    private final UserRepository                     userRepo;

    /**
     * All prescription orders for one admission with their administration history.
     *
     * readOnly transaction keeps the Hibernate session open for any lazy proxy
     * walk inside the DTO mappers (administeredBy on MedicationAdministration rows).
     */
    @GetMapping("/admission/{admissionId}")
    @Transactional(readOnly = true)
    public ResponseEntity<List<OrderCardDto>> list(
            @PathVariable UUID admissionId,
            @AuthenticationPrincipal User principal) {

        User caller = userRepo.findById(java.util.Objects.requireNonNull(principal.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        UUID hospitalId = caller.getHospital() != null ? caller.getHospital().getId() : null;

        List<PrescriptionItem> orders = (hospitalId != null)
                ? prescriptionItemRepo.findByAdmissionIdAndHospitalId(admissionId, hospitalId)
                : List.of();

        List<MedicationAdministration> admins =
                medAdminRepo.findByAdmissionIdOrderByAdministeredAtAsc(admissionId);

        Map<UUID, List<MedicationAdministration>> byOrder = admins.stream()
                .collect(Collectors.groupingBy(MedicationAdministration::getOrderId));

        List<OrderCardDto> result = orders.stream()
                .map(item -> toOrderCardDto(item, byOrder.getOrDefault(item.getId(), List.of())))
                .toList();

        return ResponseEntity.ok(result);
    }

    /**
     * Log one administration event against an existing prescription order.
     *
     * Validation order:
     *  1. Required fields present (admissionId, orderId, administeredAt, status).
     *  2. status is one of GIVEN, HELD, REFUSED.
     *  3. reason is present (non-blank) when status is HELD or REFUSED.
     *  4. Admission exists.
     *  5. Recorder's hospital matches the admission's hospital (cross-tenant guard).
     *  6. Order (prescription item) exists.
     *  7. Order's parent record admissionId matches the stated admissionId.
     */
    @PostMapping
    @Transactional
    public ResponseEntity<AdminDto> create(
            @RequestBody MarRequest req,
            @AuthenticationPrincipal User principal) {

        if (req.getAdmissionId() == null)
            throw new BadRequestException("admissionId is required");
        if (req.getOrderId() == null)
            throw new BadRequestException("orderId is required");
        if (req.getAdministeredAt() == null)
            throw new BadRequestException("administeredAt is required");
        if (req.getStatus() == null || req.getStatus().isBlank())
            throw new BadRequestException("status is required");

        String status = req.getStatus().trim().toUpperCase();
        if (!VALID_STATUSES.contains(status))
            throw new BadRequestException("status must be one of GIVEN, HELD, or REFUSED");

        if (("HELD".equals(status) || "REFUSED".equals(status))
                && (req.getReason() == null || req.getReason().isBlank()))
            throw new BadRequestException("reason is required when status is HELD or REFUSED");

        var admission = admissionRepo.findById(java.util.Objects.requireNonNull(req.getAdmissionId()))
                .orElseThrow(() -> new ResourceNotFoundException("Admission not found"));

        User recorder = userRepo.findById(java.util.Objects.requireNonNull(principal.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        UUID admissionHospitalId = admission.getHospital() != null ? admission.getHospital().getId() : null;
        UUID recorderHospitalId  = recorder.getHospital()  != null ? recorder.getHospital().getId()  : null;
        if (recorderHospitalId == null || !recorderHospitalId.equals(admissionHospitalId))
            throw new UnauthorizedException("Admission does not belong to your hospital");

        // Lazy load works here because the method is @Transactional.
        var order = prescriptionItemRepo.findById(java.util.Objects.requireNonNull(req.getOrderId()))
                .orElseThrow(() -> new ResourceNotFoundException("Prescription order not found"));

        var orderAdmissionId = order.getRecord().getAdmissionId();
        if (orderAdmissionId == null || !orderAdmissionId.equals(req.getAdmissionId()))
            throw new BadRequestException("Prescription order does not belong to this admission");

        if ("STOPPED".equals(order.getStatus()))
            throw new BadRequestException("Cannot record a dose against a stopped order");

        MedicationAdministration entity = MedicationAdministration.builder()
                .hospitalId(admissionHospitalId)
                .admissionId(req.getAdmissionId())
                .orderId(req.getOrderId())
                .patientId(admission.getPatient().getId())
                .administeredAt(req.getAdministeredAt())
                .administeredBy(recorder)
                .status(status)
                .doseGiven(blank(req.getDoseGiven())  ? null : req.getDoseGiven().trim())
                .reason(blank(req.getReason())         ? null : req.getReason().trim())
                .notes(blank(req.getNotes())            ? null : req.getNotes().trim())
                .build();

        return ResponseEntity.ok(toAdminDto(medAdminRepo.save(entity)));
    }

    // ── DTO mapping ───────────────────────────────────────────────────────────

    private OrderCardDto toOrderCardDto(PrescriptionItem item,
                                        List<MedicationAdministration> admins) {
        OrderCardDto dto = new OrderCardDto();
        dto.setOrderId(item.getId().toString());
        dto.setDrugName(item.getDrugName());
        dto.setDrugStrength(item.getDrugStrength());
        dto.setDrugForm(item.getDrugForm());
        dto.setDose(item.getDose());
        dto.setFrequency(item.getFrequency() != null ? item.getFrequency().name() : null);
        dto.setRoute(item.getRoute()          != null ? item.getRoute().name()     : null);
        dto.setInstructions(item.getInstructions());
        dto.setAllergyOverrideReason(item.getAllergyOverrideReason());

        var rec = item.getRecord();
        dto.setPrescribedAt(rec.getCreatedAt() != null ? rec.getCreatedAt().toString() : null);
        // Prefer the attending/prescribing doctor over the record's creator —
        // a staff member may enter the prescription on behalf of a doctor.
        var doc = rec.getAttendingDoctor() != null ? rec.getAttendingDoctor() : rec.getCreatedBy();
        if (doc != null) {
            dto.setPrescribedBy(doc.getFirstName() +
                    (doc.getLastName() != null ? " " + doc.getLastName() : ""));
        }

        dto.setStatus(item.getStatus());
        if ("STOPPED".equals(item.getStatus())) {
            dto.setStoppedAt(item.getStoppedAt() != null ? item.getStoppedAt().toString() : null);
            dto.setStopReason(item.getStopReason());
            if (item.getStoppedBy() != null) {
                var stopper = item.getStoppedBy();
                dto.setStoppedByName(stopper.getFirstName() +
                        (stopper.getLastName() != null ? " " + stopper.getLastName() : ""));
            }
        }

        dto.setAdministrations(admins.stream().map(this::toAdminDto).toList());
        return dto;
    }

    private AdminDto toAdminDto(MedicationAdministration a) {
        AdminDto dto = new AdminDto();
        dto.setId(a.getId().toString());
        dto.setAdministeredAt(a.getAdministeredAt() != null ? a.getAdministeredAt().toString() : null);
        dto.setStatus(a.getStatus());
        dto.setDoseGiven(a.getDoseGiven());
        dto.setReason(a.getReason());
        dto.setNotes(a.getNotes());
        dto.setCreatedAt(a.getCreatedAt() != null ? a.getCreatedAt().toString() : null);
        if (a.getAdministeredBy() != null) {
            var nurse = a.getAdministeredBy();
            dto.setAdministeredById(nurse.getId().toString());
            dto.setAdministeredByName(nurse.getFirstName() +
                    (nurse.getLastName() != null ? " " + nurse.getLastName() : ""));
        }
        return dto;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    // ── Inner request / response types ────────────────────────────────────────

    @Data
    public static class MarRequest {
        private UUID          admissionId;
        private UUID          orderId;
        private LocalDateTime administeredAt;
        /** GIVEN | HELD | REFUSED — validated before persistence. */
        private String        status;
        private String        doseGiven;
        /** Required when status is HELD or REFUSED. */
        private String        reason;
        private String        notes;
    }

    @Data
    public static class AdminDto {
        private String id;
        private String administeredAt;
        private String administeredById;
        private String administeredByName;
        private String status;
        private String doseGiven;
        private String reason;
        private String notes;
        private String createdAt;
    }

    @Data
    public static class OrderCardDto {
        private String         orderId;
        private String         drugName;
        private String         drugStrength;
        private String         drugForm;
        private String         dose;
        private String         frequency;
        private String         route;
        private String         instructions;
        private String         prescribedAt;
        private String         prescribedBy;
        /** ACTIVE or STOPPED */
        private String         status;
        private String         stoppedAt;
        private String         stoppedByName;
        private String         stopReason;
        /** Set when the prescriber overrode a recorded drug allergy for this item. */
        private String         allergyOverrideReason;
        private List<AdminDto> administrations;
    }
}
