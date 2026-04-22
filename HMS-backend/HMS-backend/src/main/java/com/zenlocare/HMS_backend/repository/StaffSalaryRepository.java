package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.StaffSalary;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StaffSalaryRepository extends JpaRepository<StaffSalary, UUID> {
    Optional<StaffSalary> findByHospitalIdAndStaffId(UUID hospitalId, UUID staffId);
    List<StaffSalary> findByHospitalId(UUID hospitalId);
}
