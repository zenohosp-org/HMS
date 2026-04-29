package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.HospitalFloor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.util.UUID;

public interface HospitalFloorRepository extends JpaRepository<HospitalFloor, Long> {

    @Modifying
    @Query("DELETE FROM HospitalFloor f WHERE f.building.hospital.id = :hospitalId")
    void deleteByHospitalId(UUID hospitalId);
}
