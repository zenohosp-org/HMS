package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.AmbulanceType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AmbulanceTypeRepository extends JpaRepository<AmbulanceType, Long> {
    List<AmbulanceType> findByHospitalIdAndActiveTrue(UUID hospitalId);
}
