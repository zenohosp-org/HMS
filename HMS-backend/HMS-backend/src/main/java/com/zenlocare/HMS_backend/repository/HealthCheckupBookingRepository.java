package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.CheckupBookingStatus;
import com.zenlocare.HMS_backend.entity.HealthCheckupBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HealthCheckupBookingRepository extends JpaRepository<HealthCheckupBooking, UUID> {

    List<HealthCheckupBooking> findByHospital_IdOrderByScheduledDateDescCreatedAtDesc(UUID hospitalId);

    List<HealthCheckupBooking> findByHospital_IdAndScheduledDateOrderByScheduledTimeAsc(UUID hospitalId, LocalDate date);

    List<HealthCheckupBooking> findByHospital_IdAndStatusOrderByScheduledDateDesc(UUID hospitalId, CheckupBookingStatus status);

    List<HealthCheckupBooking> findByPatient_IdOrderByScheduledDateDesc(Integer patientId);

    @Query("SELECT MAX(b.bookingNumber) FROM HealthCheckupBooking b WHERE b.hospital.id = :hospitalId AND b.bookingNumber LIKE CONCAT('HCP-', :year, '-%')")
    Optional<String> findMaxBookingNumberForYear(@Param("hospitalId") UUID hospitalId, @Param("year") String year);

    long countByHospital_IdAndScheduledDate(UUID hospitalId, LocalDate date);

    long countByHospital_IdAndStatus(UUID hospitalId, CheckupBookingStatus status);
}
