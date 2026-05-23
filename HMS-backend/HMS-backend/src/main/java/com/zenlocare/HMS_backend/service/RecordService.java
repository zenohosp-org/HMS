package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.HistoryType;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Transactional(readOnly = true)
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

    /** Records of a specific type for a patient, newest first. */
    public List<PatientRecord> getRecordsByPatientAndType(Integer patientId, UUID hospitalId, HistoryType type) {
        return recordRepository.findByPatientIdAndHospitalIdAndHistoryTypeOrderByCreatedAtDesc(
                patientId, hospitalId, type);
    }

    @Transactional
    public PatientRecord createRecord(UUID hospitalId, Integer patientId, User createdBy,
            String historyType, String description, LocalDateTime nextVisitDate,
            java.util.UUID admissionId, String admissionNumber) {

        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Hospital not found"));

        Patient patient = patientRepository.findByIdAndHospitalId(patientId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));

        String mrn = generateMrn(hospital);

        // Lenient parse — typos / missing values fall back to OTHERS rather than 500ing.
        HistoryType type = HistoryType.fromName(historyType);

        PatientRecord record = PatientRecord.builder()
                .hospital(hospital)
                .patient(patient)
                .createdBy(createdBy)
                .historyType(type)
                .description(description)
                .nextVisitDate(nextVisitDate)
                .admissionId(admissionId)
                .admissionNumber(admissionNumber)
                .mrn(mrn)
                .createdAt(LocalDateTime.now())
                .build();

        return recordRepository.save(record);
    }

    private String generateMrn(Hospital hospital) {
        int year = LocalDateTime.now().getYear();
        long seq = recordRepository.count() + 1 + ThreadLocalRandom.current().nextInt(100);
        return HospitalIdPrefix.of(hospital) + String.format("MRN-%d-%05d", year, seq);
    }
}
