package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.HistoryType;
import com.zenlocare.HMS_backend.entity.PatientRecord;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.service.RecordService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/records")
@RequiredArgsConstructor
public class RecordController {

    private final RecordService recordService;

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<RecordDto>> getPatientRecords(
            @PathVariable Integer patientId,
            @RequestParam UUID hospitalId) {

        List<PatientRecord> records = recordService.getRecordsByPatient(patientId, hospitalId);
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
                req.getHistoryType(), req.getDescription(), req.getNextVisitDate(),
                req.getAdmissionId(), req.getAdmissionNumber(),
                req.getAppointmentId(), req.getPrescriptionItems());
        return ResponseEntity.ok(mapToDto(record));
    }

    private RecordDto mapToDto(PatientRecord record) {
        RecordDto dto = new RecordDto();
        dto.setId(record.getId().toString());
        dto.setHistoryType(record.getHistoryType() != null ? record.getHistoryType().name() : null);
        dto.setDescription(record.getDescription());
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
                d.setFrequency(pi.getFrequency());
                d.setDurationDays(pi.getDurationDays());
                d.setQuantity(pi.getQuantity());
                d.setRoute(pi.getRoute());
                d.setInstructions(pi.getInstructions());
                d.setDisplayOrder(pi.getDisplayOrder());
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
        private LocalDateTime nextVisitDate;
        private UUID admissionId;
        private String admissionNumber;
        // OPD trace — set when this record is written for an appointment.
        // Mutually exclusive with admissionId in practice (a visit is either OPD or IPD).
        private UUID appointmentId;
        // Structured prescription lines. Required when historyType=PRESCRIPTION,
        // ignored otherwise. Pharmacy reads these to dispense.
        private java.util.List<PrescriptionItemRequest> prescriptionItems;
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
    }

    @Data
    public static class RecordDto {
        private String id;
        private String historyType;
        private String description;
        private String nextVisitDate;
        private String createdAt;
        private String admissionId;
        private String admissionNumber;
        private String appointmentId;
        private String mrn;
        private CreatorDto createdBy;
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
    }
}
