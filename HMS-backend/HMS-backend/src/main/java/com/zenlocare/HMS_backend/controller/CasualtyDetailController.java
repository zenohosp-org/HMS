package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.CasualtyDetail;
import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.Patient;
import com.zenlocare.HMS_backend.entity.PatientRecord;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.exception.ResourceNotFoundException;
import com.zenlocare.HMS_backend.repository.CasualtyDetailRepository;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.PatientRepository;
import com.zenlocare.HMS_backend.service.RecordService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients/{patientId}/casualty")
@RequiredArgsConstructor
public class CasualtyDetailController {

    private final CasualtyDetailRepository casualtyDetailRepository;
    private final PatientRepository patientRepository;
    private final HospitalRepository hospitalRepository;
    private final RecordService recordService;

    @GetMapping
    public ResponseEntity<CasualtyDetail> get(
            @PathVariable Integer patientId,
            @RequestParam UUID hospitalId) {
        return ResponseEntity.ok(
                casualtyDetailRepository.findByPatientId(patientId)
                        .orElseThrow(() -> new ResourceNotFoundException("No casualty record found"))
        );
    }

    @PostMapping
    @Transactional
    public ResponseEntity<CasualtyDetail> createOrUpdate(
            @PathVariable Integer patientId,
            @RequestParam UUID hospitalId,
            @RequestBody CasualtyRequest req,
            @AuthenticationPrincipal User user) {

        Patient patient = patientRepository.findByIdAndHospitalId(patientId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));

        // Upsert: one casualty detail per patient
        CasualtyDetail detail = casualtyDetailRepository.findByPatientId(patientId)
                .orElseGet(() -> CasualtyDetail.builder().patient(patient).build());

        detail.setTriageCategory(req.getTriageCategory());
        detail.setBroughtBy(req.getBroughtBy());
        detail.setModeOfArrival(req.getModeOfArrival());
        detail.setIsMlc(Boolean.TRUE.equals(req.getIsMlc()));
        detail.setMlcNumber(req.getMlcNumber());
        detail.setPoliceStation(req.getPoliceStation());
        detail.setOfficerName(req.getOfficerName());
        detail.setConsciousState(req.getConsciousState());
        detail.setMechanism(req.getMechanism());
        detail.setVitalsBp(req.getVitalsBp());
        detail.setVitalsPulse(req.getVitalsPulse());
        detail.setVitalsSpO2(req.getVitalsSpO2());
        detail.setVitalsGcs(req.getVitalsGcs());
        detail.setReferredFrom(req.getReferredFrom());
        detail.setArrivalTime(req.getArrivalTime() != null ? req.getArrivalTime() : LocalDateTime.now());

        CasualtyDetail saved = casualtyDetailRepository.save(detail);

        // Update patient type
        patient.setPatientType("CASUALTY");
        patientRepository.save(patient);

        // Create a PatientRecord entry for the timeline
        String description = buildCasualtyDescription(req);
        recordService.createRecord(hospitalId, patientId, user,
                "CASUALTY", description, null,
                req.getAdmissionId(), req.getAdmissionNumber());

        return ResponseEntity.ok(saved);
    }

    private String buildCasualtyDescription(CasualtyRequest r) {
        StringBuilder sb = new StringBuilder();
        if (r.getTriageCategory() != null) sb.append("Triage: ").append(r.getTriageCategory());
        if (r.getMechanism() != null) sb.append(" | Mechanism: ").append(r.getMechanism().replace("_", " "));
        if (r.getConsciousState() != null) sb.append(" | Conscious: ").append(r.getConsciousState().replace("_", " "));
        if (Boolean.TRUE.equals(r.getIsMlc()) && r.getMlcNumber() != null) sb.append(" | MLC: ").append(r.getMlcNumber());
        if (r.getVitalsBp() != null) sb.append(" | BP: ").append(r.getVitalsBp());
        if (r.getVitalsPulse() != null) sb.append(", Pulse: ").append(r.getVitalsPulse());
        if (r.getVitalsSpO2() != null) sb.append(", SpO2: ").append(r.getVitalsSpO2()).append("%");
        return sb.toString();
    }

    @Data
    public static class CasualtyRequest {
        private String triageCategory;
        private String broughtBy;
        private String modeOfArrival;
        private Boolean isMlc;
        private String mlcNumber;
        private String policeStation;
        private String officerName;
        private String consciousState;
        private String mechanism;
        private String vitalsBp;
        private String vitalsPulse;
        private String vitalsSpO2;
        private String vitalsGcs;
        private String referredFrom;
        private LocalDateTime arrivalTime;
        // Optional — links record to an IPD admission
        private UUID admissionId;
        private String admissionNumber;
    }
}
