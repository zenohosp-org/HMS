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

@Service
@RequiredArgsConstructor
public class RecordService {

    private final PatientRecordRepository recordRepository;
    private final PatientRepository patientRepository;
    private final HospitalRepository hospitalRepository;

    public List<PatientRecord> getRecordsByPatient(Integer patientId, UUID hospitalId) {
        return recordRepository.findByPatientIdAndHospitalId(patientId, hospitalId);
    }

    public PatientRecord createRecord(UUID hospitalId, Integer patientId, User createdBy,
            String historyType, String description, LocalDateTime nextVisitDate) {

        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Hospital not found"));

        Patient patient = patientRepository.findByIdAndHospitalId(patientId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));

        PatientRecord record = PatientRecord.builder()
                .hospital(hospital)
                .patient(patient)
                .createdBy(createdBy)
                .historyType(historyType)
                .description(description)
                .nextVisitDate(nextVisitDate)
                .createdAt(LocalDateTime.now())
                .build();

        return recordRepository.save(record);
    }
}
