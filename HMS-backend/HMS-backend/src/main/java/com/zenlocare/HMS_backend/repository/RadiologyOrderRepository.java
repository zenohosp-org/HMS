package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.RadiologyOrder;
import com.zenlocare.HMS_backend.entity.RadiologyStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RadiologyOrderRepository extends JpaRepository<RadiologyOrder, Long> {

    List<RadiologyOrder> findByHospitalIdOrderByCreatedAtDesc(UUID hospitalId);

    List<RadiologyOrder> findByHospitalIdAndStatusOrderByCreatedAtDesc(UUID hospitalId, RadiologyStatus status);

    List<RadiologyOrder> findByPatientIdOrderByCreatedAtDesc(Integer patientId);

    long countByHospitalIdAndStatus(UUID hospitalId, RadiologyStatus status);

    List<RadiologyOrder> findByAdmissionIdOrderByCreatedAtDesc(UUID admissionId);
}
