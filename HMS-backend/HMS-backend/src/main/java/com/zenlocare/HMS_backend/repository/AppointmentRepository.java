package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Appointment;
import com.zenlocare.HMS_backend.entity.Doctor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    List<Appointment> findByHospitalId(UUID hospitalId);

    @Query("SELECT a.status, COUNT(a) FROM Appointment a WHERE a.hospital.id = :hid GROUP BY a.status")
    List<Object[]> getStatusBreakdown(@Param("hid") UUID hospitalId);

    List<Appointment> findByHospitalIdAndApptDate(UUID hospitalId, LocalDate apptDate);

    List<Appointment> findByDoctorIdAndApptDate(UUID doctorId, LocalDate apptDate);

    List<Appointment> findByPatientIdOrderByApptDateDescApptTimeDesc(Integer patientId);

    Optional<Appointment> findByIdAndHospitalId(UUID id, UUID hospitalId);

    @Query("SELECT DISTINCT a.doctor FROM Appointment a WHERE a.patient.id = :patientId AND a.hospital.id = :hospitalId AND a.doctor IS NOT NULL " +
           "AND a.status NOT IN (" +
           "  com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.CANCELLED," +
           "  com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.NO_SHOW)")
    List<Doctor> findDistinctDoctorsByPatient(@Param("patientId") Integer patientId, @Param("hospitalId") UUID hospitalId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.doctor.id = :doctorId AND a.apptDate = :apptDate")
    Integer countByDoctorIdAndApptDate(@Param("doctorId") UUID doctorId, @Param("apptDate") LocalDate apptDate);

    /**
     * Highest token currently assigned in the hospital's today-queue. Used to
     * pick the next number when an appointment transitions into a token-
     * eligible status. Returns null when the queue is empty (caller treats
     * null as zero → first token is 1).
     */
    @Query("SELECT MAX(a.tokenNumber) FROM Appointment a " +
           "WHERE a.hospital.id = :hospitalId AND a.apptDate = :apptDate AND a.tokenNumber IS NOT NULL")
    Integer findMaxTokenNumberByHospitalIdAndApptDate(
            @Param("hospitalId") UUID hospitalId, @Param("apptDate") LocalDate apptDate);

    /**
     * Today's appointments for a hospital, ordered by booking time (createdAt
     * ASC). Backs the "Refresh Tokens" operation — re-numbering walks this
     * list and assigns 1..N in arrival order.
     */
    @Query("SELECT a FROM Appointment a WHERE a.hospital.id = :hospitalId AND a.apptDate = :apptDate " +
           "ORDER BY a.createdAt ASC")
    List<Appointment> findByHospitalIdAndApptDateOrderByCreatedAtAsc(
            @Param("hospitalId") UUID hospitalId, @Param("apptDate") LocalDate apptDate);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.doctor.id = :doctorId AND a.apptDate = :apptDate " +
           "AND a.status IN (" +
           "  com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.SCHEDULED," +
           "  com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.CONFIRMED," +
           "  com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.CHECKED_IN," +
           "  com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.IN_PROGRESS) " +
           "AND ((a.apptTime <= :startTime AND a.apptEndTime > :startTime) " +
           "  OR (a.apptTime < :endTime AND a.apptEndTime >= :endTime) " +
           "  OR (a.apptTime >= :startTime AND a.apptEndTime <= :endTime))")
    long countOverlappingAppointments(
            @Param("doctorId") UUID doctorId,
            @Param("apptDate") LocalDate apptDate,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime);

    @Query(value = """
        SELECT a FROM Appointment a
        LEFT JOIN FETCH a.patient p
        LEFT JOIN FETCH a.doctor d
        LEFT JOIN FETCH d.user du
        LEFT JOIN FETCH a.createdBy cb
        WHERE a.hospital.id = :hospitalId
        AND (:doctorId IS NULL OR a.doctor.id = :doctorId)
        AND (:dateFilter = 'ALL'
             OR (:dateFilter = 'TODAY' AND a.apptDate = :today)
             OR (:dateFilter = 'UPCOMING' AND (a.apptDate > :today OR (a.apptDate = :today AND a.status = com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.SCHEDULED)))
             OR (:dateFilter = 'COMPLETED' AND a.status = com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.COMPLETED)
             OR (:dateFilter = 'CANCELLED' AND a.status IN (
                   com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.CANCELLED,
                   com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.NO_SHOW)))
        AND (
            LOWER(a.patient.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(a.patient.lastName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(CONCAT(a.patient.firstName, ' ', a.patient.lastName)) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(a.patient.uhid) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(d.user.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(d.user.lastName) LIKE LOWER(CONCAT('%', :search, '%'))
        )
        ORDER BY
            CASE WHEN :dateFilter = 'TODAY' THEN a.createdAt END ASC,
            a.apptDate DESC, a.apptTime DESC
        """,
        countQuery = """
        SELECT COUNT(a) FROM Appointment a
        WHERE a.hospital.id = :hospitalId
        AND (:doctorId IS NULL OR a.doctor.id = :doctorId)
        AND (:dateFilter = 'ALL'
             OR (:dateFilter = 'TODAY' AND a.apptDate = :today)
             OR (:dateFilter = 'UPCOMING' AND (a.apptDate > :today OR (a.apptDate = :today AND a.status = com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.SCHEDULED)))
             OR (:dateFilter = 'COMPLETED' AND a.status = com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.COMPLETED)
             OR (:dateFilter = 'CANCELLED' AND a.status IN (
                   com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.CANCELLED,
                   com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus.NO_SHOW)))
        AND (
            LOWER(a.patient.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(a.patient.lastName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(CONCAT(a.patient.firstName, ' ', a.patient.lastName)) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(a.patient.uhid) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(a.doctor.user.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(a.doctor.user.lastName) LIKE LOWER(CONCAT('%', :search, '%'))
        )
        """)
    Page<Appointment> searchAppointments(
        @Param("hospitalId") UUID hospitalId,
        @Param("doctorId") UUID doctorId,
        @Param("dateFilter") String dateFilter,
        @Param("today") LocalDate today,
        @Param("search") String search,
        Pageable pageable
    );
}
