package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.HistoryType;
import com.zenlocare.HMS_backend.entity.PatientRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PatientRecordRepository extends JpaRepository<PatientRecord, Integer> {
    List<PatientRecord> findByPatientId(Integer patientId);

    List<PatientRecord> findByPatientIdAndHospitalId(Integer patientId, UUID hospitalId);

    List<PatientRecord> findByHospitalId(UUID hospitalId);

    List<PatientRecord> findByCreatedByIdAndHospitalIdOrderByCreatedAtDesc(UUID createdById, UUID hospitalId);

    List<PatientRecord> findByPatientIdAndHospitalIdAndHistoryTypeOrderByCreatedAtDesc(
            Integer patientId, UUID hospitalId, HistoryType historyType);

    List<PatientRecord> findByPatientIdAndHospitalIdAndAdmissionIdAndHistoryTypeOrderByCreatedAtDesc(
            Integer patientId, UUID hospitalId, UUID admissionId, HistoryType historyType);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT pr.patient.id) FROM PatientRecord pr WHERE pr.createdBy.id = :userId")
    long countUniquePatientsByDoctor(@org.springframework.data.repository.query.Param("userId") UUID userId);
}
