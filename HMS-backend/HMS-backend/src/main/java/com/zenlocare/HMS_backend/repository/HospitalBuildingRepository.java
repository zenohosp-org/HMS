package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.HospitalBuilding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.UUID;

public interface HospitalBuildingRepository extends JpaRepository<HospitalBuilding, Long> {

    @Query("SELECT DISTINCT b FROM HospitalBuilding b LEFT JOIN FETCH b.floors f LEFT JOIN FETCH f.wards WHERE b.hospital.id = :hospitalId ORDER BY b.displayOrder ASC")
    List<HospitalBuilding> findByHospitalIdWithDetails(UUID hospitalId);

    @Modifying
    @Query("DELETE FROM HospitalBuilding b WHERE b.hospital.id = :hospitalId")
    void deleteByHospitalId(UUID hospitalId);
}
