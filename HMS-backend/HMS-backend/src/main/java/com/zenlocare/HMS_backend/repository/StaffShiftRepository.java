package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.StaffShift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface StaffShiftRepository extends JpaRepository<StaffShift, Long> {

    List<StaffShift> findByHospitalIdAndShiftDateBetweenOrderByShiftDate(
            UUID hospitalId, LocalDate from, LocalDate to);

    @Query("""
            SELECT s FROM StaffShift s
            WHERE s.hospital.id = :hospitalId
              AND YEAR(s.shiftDate) = :year
              AND MONTH(s.shiftDate) = :month
            ORDER BY s.shiftDate
            """)
    List<StaffShift> findMonthlyShifts(
            @Param("hospitalId") UUID hospitalId,
            @Param("year") int year,
            @Param("month") int month);

    boolean existsByUserIdAndShiftDate(UUID userId, LocalDate shiftDate);
}
