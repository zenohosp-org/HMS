package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.HistoryType;
import com.zenlocare.HMS_backend.entity.PatientRecord;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PatientRecordRepository extends JpaRepository<PatientRecord, Integer> {

    // Every read path that returns PatientRecord(s) to the controller must
    // eagerly fetch `createdBy` — the controller's DTO mapper reads
    // createdBy.firstName / lastName / role.displayName, and PatientRecord.createdBy
    // is LAZY. Without the entity graph, those getters fire after the service's
    // @Transactional boundary closes → LazyInitializationException ("no session").
    // `createdBy.role` is EAGER on the User entity, so it rides along on the
    // createdBy fetch — no need to list it explicitly here.

    List<PatientRecord> findByPatientId(Integer patientId);

    @EntityGraph(attributePaths = {"createdBy"})
    List<PatientRecord> findByPatientIdAndHospitalId(Integer patientId, UUID hospitalId);

    List<PatientRecord> findByHospitalId(UUID hospitalId);

    @EntityGraph(attributePaths = {"createdBy"})
    List<PatientRecord> findByCreatedByIdAndHospitalIdOrderByCreatedAtDesc(UUID createdById, UUID hospitalId);

    @EntityGraph(attributePaths = {"createdBy"})
    List<PatientRecord> findByPatientIdAndHospitalIdAndHistoryTypeOrderByCreatedAtDesc(
            Integer patientId, UUID hospitalId, HistoryType historyType);

    @EntityGraph(attributePaths = {"createdBy"})
    List<PatientRecord> findByPatientIdAndHospitalIdAndAdmissionIdAndHistoryTypeOrderByCreatedAtDesc(
            Integer patientId, UUID hospitalId, UUID admissionId, HistoryType historyType);

    @Query("SELECT COUNT(DISTINCT pr.patient.id) FROM PatientRecord pr WHERE pr.createdBy.id = :userId")
    long countUniquePatientsByDoctor(@Param("userId") UUID userId);
}
