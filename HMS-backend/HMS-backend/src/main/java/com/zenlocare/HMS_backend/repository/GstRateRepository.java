package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.GstRate;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface GstRateRepository extends JpaRepository<GstRate, UUID> {
    List<GstRate> findByHospitalIdOrderByRatePercentAsc(UUID hospitalId);
    List<GstRate> findByHospitalIdAndIsActiveTrueOrderByRatePercentAsc(UUID hospitalId);
    List<GstRate> findByHospitalIdAndIsDefaultTrue(UUID hospitalId);
}
