package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Admission;
import com.zenlocare.HMS_backend.entity.AdmissionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AdmissionRepository extends JpaRepository<Admission, UUID> {
    List<Admission> findByHospitalIdAndStatusOrderByAdmissionDateDesc(UUID hospitalId, AdmissionStatus status);
    List<Admission> findByHospitalIdOrderByAdmissionDateDesc(UUID hospitalId);
    List<Admission> findByPatientIdOrderByAdmissionDateDesc(Integer patientId);
    Optional<Admission> findByPatientIdAndStatus(Integer patientId, AdmissionStatus status);
    Optional<Admission> findByRoomIdAndStatus(Long roomId, AdmissionStatus status);

    List<Admission> findByRoomId(Long roomId);

    @Query("SELECT a FROM Admission a WHERE a.hospital.id = :hospitalId " +
           "AND a.status = com.zenlocare.HMS_backend.entity.AdmissionStatus.ADMITTED " +
           "AND (LOWER(a.patient.firstName) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "OR LOWER(a.patient.lastName) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "OR LOWER(a.admissionNumber) LIKE LOWER(CONCAT('%',:q,'%')))")
    List<Admission> searchActive(@Param("hospitalId") UUID hospitalId, @Param("q") String query);

    @Query("SELECT COUNT(a) FROM Admission a WHERE a.hospital.id = :hospitalId " +
           "AND a.status = com.zenlocare.HMS_backend.entity.AdmissionStatus.ADMITTED")
    long countActiveByHospital(@Param("hospitalId") UUID hospitalId);

    @Query("SELECT COUNT(a) FROM Admission a WHERE a.hospital.id = :hospitalId " +
           "AND a.status = com.zenlocare.HMS_backend.entity.AdmissionStatus.ADMITTED " +
           "AND a.room IS NOT NULL AND a.room.roomType = 'OT'")
    long countActiveInOtByHospital(@Param("hospitalId") UUID hospitalId);

    @Query("SELECT COUNT(a) FROM Admission a WHERE a.hospital.id = :hospitalId " +
           "AND a.status = com.zenlocare.HMS_backend.entity.AdmissionStatus.DISCHARGED " +
           "AND a.actualDischargeDate >= :startOfDay")
    long countDischargedTodayByHospital(@Param("hospitalId") UUID hospitalId, @Param("startOfDay") java.time.LocalDateTime startOfDay);

    @Query("SELECT COUNT(a) FROM Admission a WHERE a.hospital.id = :hospitalId " +
           "AND a.status = com.zenlocare.HMS_backend.entity.AdmissionStatus.ADMITTED " +
           "AND a.approxDischargeDate < :now")
    long countOverdueByHospital(@Param("hospitalId") UUID hospitalId, @Param("now") java.time.LocalDateTime now);

    @Query("SELECT a FROM Admission a WHERE a.hospital.id = :hospitalId " +
           "AND (:statusStr = 'ALL' OR a.status = :status) " +
           "AND (:q = '' " +
           "     OR LOWER(a.patient.firstName) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "     OR LOWER(a.patient.lastName) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "     OR LOWER(a.admissionNumber) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "     OR LOWER(a.ipdId) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "     OR LOWER(a.department.name) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "     OR LOWER(a.room.roomNumber) LIKE LOWER(CONCAT('%',:q,'%'))" +
           ")")
    Page<Admission> searchAdmissions(
            @Param("hospitalId") UUID hospitalId,
            @Param("status") AdmissionStatus status,
            @Param("statusStr") String statusStr,
            @Param("q") String query,
            Pageable pageable);

    @Query("SELECT MAX(a.ipdId) FROM Admission a WHERE a.hospital.id = :hospitalId AND a.ipdId LIKE CONCAT('IPD-', :year, '-%')")
    Optional<String> findMaxIpdIdForYear(@Param("hospitalId") UUID hospitalId, @Param("year") String year);
}
