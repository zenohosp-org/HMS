package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;
import java.util.Optional;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, UUID> {
    List<Doctor> findByHospitalId(UUID hospitalId);

    Optional<Doctor> findByUserId(UUID userId);

    long countByHospitalIdAndSpecialization(UUID hospitalId, String specialization);

    List<Doctor> findByHospitalIdAndSpecialization(UUID hospitalId, String specialization);
}
