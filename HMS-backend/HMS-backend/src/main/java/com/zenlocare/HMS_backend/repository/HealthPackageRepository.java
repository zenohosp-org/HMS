package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.HealthPackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface HealthPackageRepository extends JpaRepository<HealthPackage, UUID> {

    // HealthPackage.tests is LAZY (default for @OneToMany), and the controller
    // serialises the entity directly — so without JOIN FETCH, Jackson sees an
    // uninitialised proxy and renders tests as []. That surfaced in the UI as
    // every package card showing "0 tests" regardless of how many tests were
    // actually saved. LEFT JOIN FETCH + DISTINCT pulls the tests in a single
    // query and de-duplicates the SQL Cartesian product.
    @Query("SELECT DISTINCT p FROM HealthPackage p " +
           "LEFT JOIN FETCH p.tests " +
           "WHERE p.hospital.id = :hospitalId " +
           "ORDER BY p.category ASC, p.name ASC")
    List<HealthPackage> findByHospitalId(@Param("hospitalId") UUID hospitalId);

    @Query("SELECT DISTINCT p FROM HealthPackage p " +
           "LEFT JOIN FETCH p.tests " +
           "WHERE p.hospital.id = :hospitalId AND p.active = true " +
           "ORDER BY p.category ASC, p.name ASC")
    List<HealthPackage> findActiveByHospitalId(@Param("hospitalId") UUID hospitalId);
}
