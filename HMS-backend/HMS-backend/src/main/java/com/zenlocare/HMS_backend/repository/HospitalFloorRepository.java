package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.HospitalFloor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

public interface HospitalFloorRepository extends JpaRepository<HospitalFloor, Long> {

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM hospital_floors WHERE building_id IN (SELECT id FROM hospital_buildings WHERE hospital_id = :hospitalId)", nativeQuery = true)
    void deleteByHospitalId(UUID hospitalId);
}
