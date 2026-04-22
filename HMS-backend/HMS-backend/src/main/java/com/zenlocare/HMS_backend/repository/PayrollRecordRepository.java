package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.PayrollRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PayrollRecordRepository extends JpaRepository<PayrollRecord, UUID> {
    List<PayrollRecord> findByHospitalIdAndMonthAndYear(UUID hospitalId, int month, int year);
    Optional<PayrollRecord> findByHospitalIdAndStaffIdAndMonthAndYear(UUID hospitalId, UUID staffId, int month, int year);
    List<PayrollRecord> findByHospitalIdAndStaffIdOrderByYearDescMonthDesc(UUID hospitalId, UUID staffId);
}
