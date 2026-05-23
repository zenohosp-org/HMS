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

    @PostMapping
    public ResponseEntity<RecordDto> createRecord(
            @RequestBody CreateRecordRequest req,
            @AuthenticationPrincipal User user) {

        PatientRecord record = recordService.createRecord(
                req.getHospitalId(), req.getPatientId(), user,
                req.getHistoryType(), req.getDescription(), req.getNextVisitDate(),
                req.getAdmissionId(), req.getAdmissionNumber());
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
        dto.setMrn(record.getMrn());

        RecordDto.CreatorDto creator = new RecordDto.CreatorDto();
        creator.setFirstName(record.getCreatedBy().getFirstName());
        creator.setLastName(record.getCreatedBy().getLastName());
        creator.setRole(record.getCreatedBy().getRole().getDisplayName());
        dto.setCreatedBy(creator);

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
        private String mrn;
        private CreatorDto createdBy;

        @Data
        public static class CreatorDto {
            private String firstName;
            private String lastName;
            private String role;
        }
    }
}
