package com.zenlocare.HMS_backend.controller;

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

    @PostMapping
    public ResponseEntity<RecordDto> createRecord(
            @RequestBody CreateRecordRequest req,
            @AuthenticationPrincipal User user) {

        PatientRecord record = recordService.createRecord(
                req.getHospitalId(), req.getPatientId(), user,
                req.getHistoryType(), req.getDescription(), req.getNextVisitDate());
        return ResponseEntity.ok(mapToDto(record));
    }

    private RecordDto mapToDto(PatientRecord record) {
        RecordDto dto = new RecordDto();
        dto.setId(record.getId().toString());
        dto.setHistoryType(record.getHistoryType());
        dto.setDescription(record.getDescription());
        dto.setNextVisitDate(record.getNextVisitDate() != null ? record.getNextVisitDate().toString() : null);
        dto.setCreatedAt(record.getCreatedAt().toString());

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
    }

    @Data
    public static class RecordDto {
        private String id;
        private String historyType;
        private String description;
        private String nextVisitDate;
        private String createdAt;
        private CreatorDto createdBy;

        @Data
        public static class CreatorDto {
            private String firstName;
            private String lastName;
            private String role;
        }
    }
}
