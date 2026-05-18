package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.Patient;
import com.zenlocare.HMS_backend.entity.PatientRecord;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.exception.ResourceNotFoundException;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.PatientRecordRepository;
import com.zenlocare.HMS_backend.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class RecordService {

    private final PatientRecordRepository recordRepository;
    private final PatientRepository patientRepository;
    private final HospitalRepository hospitalRepository;

    public List<PatientRecord> getRecordsByPatient(Integer patientId, UUID hospitalId) {
        return recordRepository.findByPatientIdAndHospitalId(patientId, hospitalId);
    }

    public List<PatientRecord> getRecordsByUser(UUID userId, UUID hospitalId) {
        return recordRepository.findByCreatedByIdAndHospitalIdOrderByCreatedAtDesc(userId, hospitalId);
    }

    public PatientRecord createRecord(UUID hospitalId, Integer patientId, User createdBy,
            String historyType, String description, LocalDateTime nextVisitDate,
            java.util.UUID admissionId, String admissionNumber) {

        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Hospital not found"));

        Patient patient = patientRepository.findByIdAndHospitalId(patientId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));

        String mrn = generateMrn();

        PatientRecord record = PatientRecord.builder()
                .hospital(hospital)
                .patient(patient)
                .createdBy(createdBy)
                .historyType(historyType)
                .description(description)
                .nextVisitDate(nextVisitDate)
                .admissionId(admissionId)
                .admissionNumber(admissionNumber)
                .mrn(mrn)
                .createdAt(LocalDateTime.now())
                .build();

        return recordRepository.save(record);
    }

    private String generateMrn() {
        int year = LocalDateTime.now().getYear();
        long seq = recordRepository.count() + 1 + ThreadLocalRandom.current().nextInt(100);
        return String.format("MRN-%d-%05d", year, seq);
    }
}
