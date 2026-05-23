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

    // Count of all non-cancelled bookings — used by the dashboard "total" widget.
    // Replaces `findByHospital_IdOrderByCreatedAtDesc().size()` which loaded
    // every row into memory just to call .size().
    @Query("SELECT COUNT(b) FROM AmbulanceBooking b " +
           "WHERE b.hospital.id = :hospitalId " +
           "AND b.status <> com.zenlocare.HMS_backend.entity.AmbulanceBookingStatus.CANCELLED")
    long countActiveByHospitalId(UUID hospitalId);

    List<AmbulanceBooking> findByPatient_IdAndHospital_Id(Integer patientId, UUID hospitalId);

    /**
     * Eligible ambulance bookings for auto-merge into a patient's IPD bill:
     * same hospital + same patient + ambulance reached this hospital +
     * not already merged + not cancelled. Ordered oldest-first so the audit
     * trail in the IPD bill lists earlier bookings first.
     */
    @Query("""
        SELECT b FROM AmbulanceBooking b
        WHERE b.hospital.id = :hospitalId
          AND b.patient.id = :patientId
          AND b.reachedToSameHospital = TRUE
          AND (b.mergedToIpd IS NULL OR b.mergedToIpd = FALSE)
          AND b.status <> com.zenlocare.HMS_backend.entity.AmbulanceBookingStatus.CANCELLED
        ORDER BY b.createdAt ASC
    """)
    List<AmbulanceBooking> findEligibleForIpdMerge(
            @org.springframework.data.repository.query.Param("hospitalId") UUID hospitalId,
            @org.springframework.data.repository.query.Param("patientId") Integer patientId);
}
