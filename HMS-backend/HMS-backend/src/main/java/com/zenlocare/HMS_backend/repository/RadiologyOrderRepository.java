package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.RadiologyOrder;
import com.zenlocare.HMS_backend.entity.RadiologyStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RadiologyOrderRepository extends JpaRepository<RadiologyOrder, Long> {

    List<RadiologyOrder> findByHospitalIdOrderByCreatedAtDesc(UUID hospitalId);

    List<RadiologyOrder> findByHospitalIdAndStatusOrderByCreatedAtDesc(UUID hospitalId, RadiologyStatus status);

    // "Completed report" set — REPORT_GENERATED + BILLED. The reports-page UI was
    // filtering strictly by REPORT_GENERATED, but radiology auto-billing flips
    // priced orders straight to BILLED inside the same transaction that generates
    // the report. Without the IN-clause variant, every auto-billed report
    // disappeared from the "completed reports" list.
    List<RadiologyOrder> findByHospitalIdAndStatusInOrderByCreatedAtDesc(
            UUID hospitalId, java.util.Collection<RadiologyStatus> statuses);

    List<RadiologyOrder> findByPatientIdOrderByCreatedAtDesc(Integer patientId);

    long countByHospitalIdAndStatus(UUID hospitalId, RadiologyStatus status);

    long countByHospitalIdAndStatusIn(UUID hospitalId, java.util.Collection<RadiologyStatus> statuses);

    List<RadiologyOrder> findByAdmissionIdOrderByCreatedAtDesc(UUID admissionId);
}
