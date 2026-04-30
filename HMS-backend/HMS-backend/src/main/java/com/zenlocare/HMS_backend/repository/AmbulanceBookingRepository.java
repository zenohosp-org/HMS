package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.AmbulanceBooking;
import com.zenlocare.HMS_backend.entity.AmbulanceBookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface AmbulanceBookingRepository extends JpaRepository<AmbulanceBooking, Long> {

    List<AmbulanceBooking> findByHospital_IdOrderByCreatedAtDesc(UUID hospitalId);

    List<AmbulanceBooking> findByHospital_IdAndStatusOrderByCreatedAtDesc(UUID hospitalId, AmbulanceBookingStatus status);

    List<AmbulanceBooking> findByHospital_IdAndBookingDateOrderByBookingTimeAsc(UUID hospitalId, LocalDate date);

    @Query("SELECT COUNT(b) FROM AmbulanceBooking b WHERE b.hospital.id = :hospitalId AND b.bookingDate = :date")
    long countByHospitalIdAndDate(UUID hospitalId, LocalDate date);

    long countByHospital_IdAndStatus(UUID hospitalId, AmbulanceBookingStatus status);
}
