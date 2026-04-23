package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Admission;
import com.zenlocare.HMS_backend.entity.AdmissionStatus;
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

    @Query("SELECT a FROM Admission a WHERE a.hospital.id = :hospitalId AND a.status = 'ADMITTED' " +
           "AND (LOWER(a.patient.firstName) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "OR LOWER(a.patient.lastName) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "OR LOWER(a.admissionNumber) LIKE LOWER(CONCAT('%',:q,'%')))")
    List<Admission> searchActive(@Param("hospitalId") UUID hospitalId, @Param("q") String query);

    @Query("SELECT COUNT(a) FROM Admission a WHERE a.hospital.id = :hospitalId AND a.status = 'ADMITTED'")
    long countActiveByHospital(@Param("hospitalId") UUID hospitalId);
}
