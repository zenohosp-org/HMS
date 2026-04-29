package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.HospitalWard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.util.UUID;

public interface HospitalWardRepository extends JpaRepository<HospitalWard, Long> {

    @Modifying
    @Query("DELETE FROM HospitalWard w WHERE w.floor.building.hospital.id = :hospitalId")
    void deleteByHospitalId(UUID hospitalId);
}
