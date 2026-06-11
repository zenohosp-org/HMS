package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.Admission;
import com.zenlocare.HMS_backend.entity.HistoryType;
import com.zenlocare.HMS_backend.entity.PatientRecord;
import com.zenlocare.HMS_backend.entity.PrescriptionDispenseStatus;
import com.zenlocare.HMS_backend.entity.PrescriptionItem;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.repository.AdmissionRepository;
import com.zenlocare.HMS_backend.repository.PrescriptionItemRepository;
import com.zenlocare.HMS_backend.service.RecordService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/records")
@RequiredArgsConstructor
public class RecordController {

    private final RecordService recordService;
    private final PrescriptionItemRepository prescriptionItemRepository;
    private final AdmissionRepository admissionRepository;

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<RecordDto>> getPatientRecords(
            @PathVariable Integer patientId,
            @RequestParam UUID hospitalId,
            @RequestParam(required = false) UUID admissionId) {

        List<PatientRecord> records = (admissionId != null)
                ? recordService.getRecordsByPatientAndAdmission(patientId, hospitalId, admissionId)
                : recordService.getRecordsByPatient(patientId, hospitalId);
        List<RecordDto> dtos = records.stream().map(this::mapToDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/by-user")
    public ResponseEntity<List<RecordDto>> getRecordsByUser(
            @RequestParam UUID userId,
            @RequestParam UUID hospitalId) {

        List<PatientRecord> records = recordService.getRecordsByUser(userId, hospitalId);
        List<RecordDto> dtos = records.stream().map(this::mapToDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Prescription records, newest first.
     *
     * Without admissionId — every prescription this patient ever received at
     * this hospital, across all admissions and OPD visits.
     *
     * With admissionId — only the prescriptions tied to that specific
     * admission (i.e. only records whose admission_id FK matches). Useful for
     * the IPD pharmacy workflow where you want to see what was prescribed
     * during the current stay, not the patient's lifetime history.
     */
    @GetMapping("/patient/{patientId}/prescriptions")
    public ResponseEntity<List<RecordDto>> getPatientPrescriptions(
            @PathVariable Integer patientId,
            @RequestParam UUID hospitalId,
            @RequestParam(required = false) UUID admissionId) {

        List<PatientRecord> records = (admissionId != null)
                ? recordService.getRecordsByPatientAndAdmissionAndType(patientId, hospitalId, admissionId, HistoryType.PRESCRIPTION)
                : recordService.getRecordsByPatientAndType(patientId, hospitalId, HistoryType.PRESCRIPTION);
        List<RecordDto> dtos = records.stream().map(this::mapToDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Records tied to a single appointment — the print view's primary
     * input. Returns every record linked to the appointment, newest
     * first. Usually one row (the CONSULTATION / PRESCRIPTION saved
     * at Mark Complete) but the doctor can amend after the fact via
     * a follow-up note, so the list shape supports that case.
     */
    @GetMapping("/by-appointment/{appointmentId}")
    public ResponseEntity<List<RecordDto>> getRecordsByAppointment(
            @PathVariable UUID appointmentId,
            @RequestParam UUID hospitalId) {

        List<RecordDto> dtos = recordService
                .getRecordsByAppointment(appointmentId, hospitalId)
                .stream().map(this::mapToDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Hospital-wide pending IPD prescription queue for the pharmacy.
     * Returns one row per undispensed prescription line across every active
     * admission in the hospital. Ordered oldest-first so urgent IPD requests
     * surface at the top of the pharmacist's queue.
     *
     * Authenticated cross-service call (pharmacy backend hits this with the
     * shared SSO JWT). No additional role gate so the pharmacy service user
     * isn't tied to a specific HMS role — same boundary other proxy
     * endpoints use.
     */
    @GetMapping("/prescriptions/pending")
    @Transactional(readOnly = true)
    public ResponseEntity<List<PendingPrescriptionDto>> getPendingPrescriptions(
            @RequestParam UUID hospitalId) {

        List<PrescriptionItem> items = prescriptionItemRepository.findPendingIpd(hospitalId);

        // Batch-load admissions once so each row can carry room + ward labels
        // without forcing a per-row lookup. PatientRecord stores admission as
        // a raw UUID FK, not an entity ref, so we resolve it here.
        java.util.Set<UUID> admissionIds = items.stream()
                .map(pi -> pi.getRecord().getAdmissionId())
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, Admission> admissions = new HashMap<>();
        if (!admissionIds.isEmpty()) {
            admissionRepository.findAllById(admissionIds).forEach(a -> admissions.put(a.getId(), a));
        }

        List<PendingPrescriptionDto> dtos = items.stream()
                .map(pi -> toPendingDto(pi, admissions.get(pi.getRecord().getAdmissionId())))
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Pharmacy callback: mark prescription items dispensed after a successful
     * ward issue. Caller (pharmacy) only invokes when its own transaction has
     * already committed — server-side this is best-effort and idempotent per
     * the caller's discretion (we add to dispensedQty without dedup tokens).
     *
     * Each item update is atomic with its row save inside the controller's
     * @Transactional so a partial-batch failure won't leave dispensedQty
     * inconsistent with dispenseStatus.
     */
    @PostMapping("/prescriptions/dispense")
    @Transactional
    public ResponseEntity<List<PrescriptionDispenseResultDto>> markDispensed(
            @RequestBody MarkDispensedRequest req) {

        List<PrescriptionDispenseResultDto> results = new java.util.ArrayList<>();
        if (req.getItems() == null) return ResponseEntity.ok(results);

        for (DispenseItemRequest row : req.getItems()) {
            if (row.getPrescriptionItemId() == null || row.getQty() == null || row.getQty() <= 0) continue;
            PrescriptionItem pi = prescriptionItemRepository.findById(row.getPrescriptionItemId()).orElse(null);
            if (pi == null) continue;

            int prescribed = pi.getQuantity() != null ? pi.getQuantity() : 0;
            int already = pi.getDispensedQty() != null ? pi.getDispensedQty() : 0;
            int next = Math.min(prescribed, already + row.getQty());
            pi.setDispensedQty(next);
            pi.setDispenseStatus(next >= prescribed
                    ? PrescriptionDispenseStatus.DISPENSED
                    : PrescriptionDispenseStatus.PARTIAL);
            prescriptionItemRepository.save(pi);

            PrescriptionDispenseResultDto r = new PrescriptionDispenseResultDto();
            r.setPrescriptionItemId(pi.getId().toString());
            r.setDispensedQty(pi.getDispensedQty());
            r.setStatus(pi.getDispenseStatus().name());
            results.add(r);
        }
        return ResponseEntity.ok(results);
    }

    private PendingPrescriptionDto toPendingDto(PrescriptionItem pi, Admission admission) {
        PendingPrescriptionDto d = new PendingPrescriptionDto();
        d.setPrescriptionItemId(pi.getId().toString());
        d.setRecordId(pi.getRecord().getId().toString());
        d.setAdmissionId(pi.getRecord().getAdmissionId() != null ? pi.getRecord().getAdmissionId().toString() : null);

        var patient = pi.getRecord().getPatient();
        d.setPatientId(patient != null ? patient.getId() : null);
        d.setPatientName(patient != null
                ? ((patient.getFirstName() != null ? patient.getFirstName() : "") + " "
                   + (patient.getLastName() != null ? patient.getLastName() : "")).trim()
                : null);

        if (admission != null && admission.getRoom() != null) {
            d.setRoomLabel(admission.getRoom().getRoomNumber());
            d.setWardLabel(admission.getRoom().getHospitalWard() != null ? admission.getRoom().getHospitalWard().getName() : null);
        }

        d.setDrugId(pi.getDrugId() != null ? pi.getDrugId().toString() : null);
        d.setDrugName(pi.getDrugName());
        d.setDrugStrength(pi.getDrugStrength());
        d.setDrugForm(pi.getDrugForm());
        d.setDose(pi.getDose());
        d.setFrequency(pi.getFrequency() != null ? pi.getFrequency().name() : null);
        d.setDurationDays(pi.getDurationDays());
        d.setRoute(pi.getRoute() != null ? pi.getRoute().name() : null);
        d.setInstructions(pi.getInstructions());
        d.setQuantity(pi.getQuantity());
        d.setDispensedQty(pi.getDispensedQty());
        d.setStatus(pi.getDispenseStatus() != null ? pi.getDispenseStatus().name() : "PENDING");
        d.setPrescribedAt(pi.getRecord().getCreatedAt() != null ? pi.getRecord().getCreatedAt().toString() : null);

        var doctor = pi.getRecord().getCreatedBy();
        if (doctor != null) {
            d.setDoctorName(((doctor.getFirstName() != null ? doctor.getFirstName() : "") + " "
                            + (doctor.getLastName() != null ? doctor.getLastName() : "")).trim());
        }
        return d;
    }

    /**
     * Create a clinical record. Gated to clinicians + hospital_admin — staff
     * shouldn't be writing prescriptions or diagnoses. The frontend's
     * "Write Prescription" action sits on appointment rows whose status is
     * CHECKED_IN or beyond; service-side state checks belong on the picker
     * UI rather than here.
     */
    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('doctor', 'hospital_admin', 'super_admin')")
    public ResponseEntity<RecordDto> createRecord(
            @RequestBody CreateRecordRequest req,
            @AuthenticationPrincipal User user) {

        PatientRecord record = recordService.createRecord(
                req.getHospitalId(), req.getPatientId(), user,
                req.getHistoryType(), req.getDescription(), req.getInstructions(),
                req.getNextVisitDate(),
                req.getAdmissionId(), req.getAdmissionNumber(),
                req.getAppointmentId(), req.getPrescriptionItems(),
                req.getAttendingDoctorId(),
                req.getSoapSubjective(), req.getSoapObjective(),
                req.getSoapAssessment(), req.getSoapPlan());
        return ResponseEntity.ok(mapToDto(record));
    }

    private RecordDto mapToDto(PatientRecord record) {
        RecordDto dto = new RecordDto();
        dto.setId(record.getId().toString());
        dto.setHistoryType(record.getHistoryType() != null ? record.getHistoryType().name() : null);
        dto.setDescription(record.getDescription());
        dto.setInstructions(record.getInstructions());
        dto.setSoapSubjective(record.getSoapSubjective());
        dto.setSoapObjective(record.getSoapObjective());
        dto.setSoapAssessment(record.getSoapAssessment());
        dto.setSoapPlan(record.getSoapPlan());
        dto.setNextVisitDate(record.getNextVisitDate() != null ? record.getNextVisitDate().toString() : null);
        dto.setCreatedAt(record.getCreatedAt().toString());
        dto.setAdmissionId(record.getAdmissionId() != null ? record.getAdmissionId().toString() : null);
        dto.setAdmissionNumber(record.getAdmissionNumber());
        dto.setAppointmentId(record.getAppointmentId() != null ? record.getAppointmentId().toString() : null);
        dto.setMrn(record.getMrn());

        RecordDto.CreatorDto creator = new RecordDto.CreatorDto();
        creator.setFirstName(record.getCreatedBy().getFirstName());
        creator.setLastName(record.getCreatedBy().getLastName());
        creator.setRole(record.getCreatedBy().getRole().getDisplayName());
        dto.setCreatedBy(creator);

        if (record.getAttendingDoctor() != null) {
            var doc = record.getAttendingDoctor();
            dto.setAttendingDoctorId(doc.getId().toString());
            dto.setAttendingDoctorName(
                ((doc.getFirstName() != null ? doc.getFirstName() : "") +
                (doc.getLastName() != null ? " " + doc.getLastName() : "")).trim());
        }

        // Always emit an array (empty for non-prescription records) so the
        // frontend has a stable shape to iterate without null guards.
        java.util.List<PrescriptionItemDto> items = new java.util.ArrayList<>();
        if (record.getPrescriptionItems() != null) {
            for (com.zenlocare.HMS_backend.entity.PrescriptionItem pi : record.getPrescriptionItems()) {
                PrescriptionItemDto d = new PrescriptionItemDto();
                d.setId(pi.getId() != null ? pi.getId().toString() : null);
                d.setDrugId(pi.getDrugId() != null ? pi.getDrugId().toString() : null);
                d.setDrugName(pi.getDrugName());
                d.setDrugGeneric(pi.getDrugGeneric());
                d.setDrugStrength(pi.getDrugStrength());
                d.setDrugForm(pi.getDrugForm());
                d.setDose(pi.getDose());
                d.setFrequency(pi.getFrequency() != null ? pi.getFrequency().name() : null);
                d.setDurationDays(pi.getDurationDays());
                d.setQuantity(pi.getQuantity());
                d.setRoute(pi.getRoute() != null ? pi.getRoute().name() : null);
                d.setInstructions(pi.getInstructions());
                d.setDisplayOrder(pi.getDisplayOrder());
                d.setStatus(pi.getStatus());
                if ("STOPPED".equals(pi.getStatus())) {
                    d.setStoppedAt(pi.getStoppedAt() != null ? pi.getStoppedAt().toString() : null);
                    d.setStopReason(pi.getStopReason());
                }
                d.setAllergyOverrideReason(pi.getAllergyOverrideReason());
                items.add(d);
            }
        }
        dto.setPrescriptionItems(items);

        return dto;
    }

    @Data
    public static class CreateRecordRequest {
        private UUID hospitalId;
        private Integer patientId;
        private String historyType;
        private String description;
        private String instructions;
        private LocalDateTime nextVisitDate;
        private UUID admissionId;
        private String admissionNumber;
        // OPD trace — set when this record is written for an appointment.
        // Mutually exclusive with admissionId in practice (a visit is either OPD or IPD).
        private UUID appointmentId;
        // Structured prescription lines. Required when historyType=PRESCRIPTION,
        // ignored otherwise. Pharmacy reads these to dispense.
        private java.util.List<PrescriptionItemRequest> prescriptionItems;
        // The doctor who attended/prescribed — users.id UUID. May differ from the
        // authenticated user when a staff member enters on behalf of a doctor.
        private UUID attendingDoctorId;
        // Structured SOAP note fields, used when historyType=PROGRESS_NOTE.
        private String soapSubjective;
        private String soapObjective;
        private String soapAssessment;
        private String soapPlan;
    }

    @Data
    public static class PrescriptionItemRequest {
        private UUID drugId;          // nullable: free-text drugs allowed
        private String drugName;      // required
        private String drugGeneric;
        private String drugStrength;
        private String drugForm;
        private String dose;
        private String frequency;
        private Integer durationDays;
        private Integer quantity;
        private String route;
        private String instructions;
        private Integer displayOrder;
        // Set when the prescriber acknowledged & overrode a recorded drug allergy.
        private String allergyOverrideReason;
    }

    @Data
    public static class RecordDto {
        private String id;
        private String historyType;
        private String description;
        private String instructions;
        // Structured SOAP note fields — populated only for PROGRESS_NOTE records.
        private String soapSubjective;
        private String soapObjective;
        private String soapAssessment;
        private String soapPlan;
        private String nextVisitDate;
        private String createdAt;
        private String admissionId;
        private String admissionNumber;
        private String appointmentId;
        private String mrn;
        private CreatorDto createdBy;
        private String attendingDoctorId;
        private String attendingDoctorName;
        private java.util.List<PrescriptionItemDto> prescriptionItems;

        @Data
        public static class CreatorDto {
            private String firstName;
            private String lastName;
            private String role;
        }
    }

    @Data
    public static class PrescriptionItemDto {
        private String id;
        private String drugId;
        private String drugName;
        private String drugGeneric;
        private String drugStrength;
        private String drugForm;
        private String dose;
        private String frequency;
        private Integer durationDays;
        private Integer quantity;
        private String route;
        private String instructions;
        private Integer displayOrder;
        /** ACTIVE or STOPPED — order lifecycle state from PrescriptionItem. */
        private String status;
        /** Set only when status is STOPPED. */
        private String stoppedAt;
        private String stopReason;
        /** Set when the prescriber overrode a recorded drug allergy for this item. */
        private String allergyOverrideReason;
    }

    @Data
    public static class PendingPrescriptionDto {
        private String prescriptionItemId;
        private String recordId;
        private String admissionId;
        private Integer patientId;
        private String patientName;
        private String roomLabel;
        private String wardLabel;
        private String drugId;
        private String drugName;
        private String drugStrength;
        private String drugForm;
        private String dose;
        private String frequency;
        private Integer durationDays;
        private String route;
        private String instructions;
        private Integer quantity;
        private Integer dispensedQty;
        private String status;
        private String prescribedAt;
        private String doctorName;
    }

    @Data
    public static class MarkDispensedRequest {
        private List<DispenseItemRequest> items;
    }

    @Data
    public static class DispenseItemRequest {
        private UUID prescriptionItemId;
        private Integer qty;
    }

    @Data
    public static class PrescriptionDispenseResultDto {
        private String prescriptionItemId;
        private Integer dispensedQty;
        private String status;
    }
}
