package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.AmbulanceVehicle;
import com.zenlocare.HMS_backend.entity.AmbulanceVehicleStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AmbulanceVehicleRepository extends JpaRepository<AmbulanceVehicle, Long> {
    List<AmbulanceVehicle> findByHospital_IdOrderByCreatedAtDesc(UUID hospitalId);
    List<AmbulanceVehicle> findByHospital_IdAndStatusOrderByVehicleNumberAsc(UUID hospitalId, AmbulanceVehicleStatus status);
}
