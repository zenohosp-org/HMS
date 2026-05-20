package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.BirthRecord;
import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.Patient;
import com.zenlocare.HMS_backend.entity.PaymentCategory;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.exception.ResourceNotFoundException;
import com.zenlocare.HMS_backend.repository.BirthRecordRepository;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.PatientRepository;
import com.zenlocare.HMS_backend.service.RecordService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/api/patients/{patientId}/birth")
@RequiredArgsConstructor
public class BirthRecordController {

    private final BirthRecordRepository birthRecordRepository;
    private final PatientRepository patientRepository;
    private final HospitalRepository hospitalRepository;
    private final RecordService recordService;

    @GetMapping
    public ResponseEntity<List<BirthRecord>> list(
            @PathVariable Integer patientId,
            @RequestParam UUID hospitalId) {
        return ResponseEntity.ok(birthRecordRepository.findByMother_Id(patientId));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<BirthRecord> create(
            @PathVariable Integer patientId,
            @RequestParam UUID hospitalId,
            @RequestBody BirthRequest req,
            @AuthenticationPrincipal User user) {

        Patient mother = patientRepository.findByIdAndHospitalId(patientId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));

        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Hospital not found"));

        // Auto-register the baby as a new patient
        String babyUhid = generateUhid(hospitalId);
        String babyFirstName = "Baby of " + mother.getFirstName();
        String babyLastName = mother.getLastName() != null ? mother.getLastName() : ".";
        LocalDate babyDob = req.getBirthDatetime() != null ? req.getBirthDatetime().toLocalDate() : LocalDate.now();

        Patient baby = Patient.builder()
                .hospital(hospital)
                .uhid(babyUhid)
                .firstName(babyFirstName)
                .lastName(babyLastName)
                .dob(babyDob)
                .gender(mapBabyGender(req.getBabyGender()))
                .phone(mother.getPhone())
                .patientType("NEWBORN")
                .motherPatientId(patientId)
                .paymentCategory(PaymentCategory.CASH)
                .build();

        Patient savedBaby = patientRepository.save(baby);

        BirthRecord record = BirthRecord.builder()
                .mother(mother)
                .baby(savedBaby)
                .hospital(hospital)
                .fatherName(req.getFatherName())
                .fatherPhone(req.getFatherPhone())
                .deliveryType(req.getDeliveryType())
                .birthDatetime(req.getBirthDatetime())
                .babyGender(req.getBabyGender())
                .babyWeightKg(req.getBabyWeightKg())
                .apgar1Min(req.getApgar1Min())
                .apgar5Min(req.getApgar5Min())
                .obstetrician(req.getObstetrician())
                .pediatrician(req.getPediatrician())
                .complications(req.getComplications())
                .build();

        BirthRecord saved = birthRecordRepository.save(record);

        // Create a PatientRecord entry on the mother's timeline
        String description = buildBirthDescription(req, savedBaby.getUhid());
        recordService.createRecord(hospitalId, patientId, user,
                "BIRTH", description, null,
                req.getAdmissionId(), req.getAdmissionNumber());

        return ResponseEntity.ok(saved);
    }

    private String mapBabyGender(String babyGender) {
        if ("MALE".equalsIgnoreCase(babyGender)) return "Male";
        if ("FEMALE".equalsIgnoreCase(babyGender)) return "Female";
        return "Other";
    }

    private String buildBirthDescription(BirthRequest r, String babyUhid) {
        StringBuilder sb = new StringBuilder();
        sb.append("Delivery: ").append(r.getDeliveryType() != null ? r.getDeliveryType() : "—");
        if (r.getBabyGender() != null) sb.append(" | Baby: ").append(r.getBabyGender());
        if (r.getBabyWeightKg() != null) sb.append(", ").append(r.getBabyWeightKg()).append(" kg");
        if (r.getApgar1Min() != null) sb.append(" | APGAR 1min: ").append(r.getApgar1Min());
        if (r.getApgar5Min() != null) sb.append(", 5min: ").append(r.getApgar5Min());
        if (r.getFatherName() != null) sb.append(" | Father: ").append(r.getFatherName());
        sb.append(" | Baby UHID: ").append(babyUhid);
        return sb.toString();
    }

    private String generateUhid(UUID hospitalId) {
        String uhid;
        do {
            long value = 10_000_000_000_000L + ThreadLocalRandom.current().nextLong(90_000_000_000_000L);
            uhid = String.valueOf(value);
        } while (patientRepository.findByHospitalIdAndUhid(hospitalId, uhid).isPresent());
        return uhid;
    }

    @Data
    public static class BirthRequest {
        private String fatherName;
        private String fatherPhone;
        private String deliveryType;
        private LocalDateTime birthDatetime;
        private String babyGender;
        private BigDecimal babyWeightKg;
        private Integer apgar1Min;
        private Integer apgar5Min;
        private String obstetrician;
        private String pediatrician;
        private String complications;
        // Optional — links record to an IPD admission
        private UUID admissionId;
        private String admissionNumber;
    }
}
