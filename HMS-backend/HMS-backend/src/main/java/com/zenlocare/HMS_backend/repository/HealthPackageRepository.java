package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.HealthPackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface HealthPackageRepository extends JpaRepository<HealthPackage, UUID> {

    @Query("SELECT p FROM HealthPackage p WHERE p.hospital.id = :hospitalId ORDER BY p.category ASC, p.name ASC")
    List<HealthPackage> findByHospitalId(UUID hospitalId);

    @Query("SELECT p FROM HealthPackage p WHERE p.hospital.id = :hospitalId AND p.active = true ORDER BY p.category ASC, p.name ASC")
    List<HealthPackage> findActiveByHospitalId(UUID hospitalId);
}
