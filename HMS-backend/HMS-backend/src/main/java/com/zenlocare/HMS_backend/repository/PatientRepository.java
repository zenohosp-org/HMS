package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientRepository extends JpaRepository<Patient, Integer> {
    List<Patient> findByHospitalId(UUID hospitalId);

    Optional<Patient> findByHospitalIdAndMrn(UUID hospitalId, String mrn);

    Optional<Patient> findByIdAndHospitalId(Integer patientId, UUID hospitalId);

    long countByHospitalId(UUID hospitalId);

    @org.springframework.data.jpa.repository.Query("SELECT p FROM Patient p WHERE p.hospital.id = :hospitalId AND " +
            "(LOWER(p.firstName) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
            "OR LOWER(p.lastName) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
            "OR LOWER(p.mrn) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
            "OR LOWER(p.phone) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    List<Patient> searchPatients(
            @org.springframework.data.repository.query.Param("hospitalId") UUID hospitalId,
            @org.springframework.data.repository.query.Param("searchTerm") String searchTerm,
            org.springframework.data.domain.Pageable pageable);
}
