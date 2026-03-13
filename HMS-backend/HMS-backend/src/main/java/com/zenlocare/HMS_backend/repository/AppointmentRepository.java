package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Appointment;
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

    List<Appointment> findByHospitalIdAndApptDate(UUID hospitalId, LocalDate apptDate);

    List<Appointment> findByDoctorIdAndApptDate(UUID doctorId, LocalDate apptDate);

    List<Appointment> findByPatientIdOrderByApptDateDescApptTimeDesc(Integer patientId);

    Optional<Appointment> findByIdAndHospitalId(UUID id, UUID hospitalId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.doctor.id = :doctorId AND a.apptDate = :apptDate")
    Integer countByDoctorIdAndApptDate(@Param("doctorId") UUID doctorId, @Param("apptDate") LocalDate apptDate);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.doctor.id = :doctorId AND a.apptDate = :apptDate AND a.status IN ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS') AND ((a.apptTime <= :startTime AND a.apptEndTime > :startTime) OR (a.apptTime < :endTime AND a.apptEndTime >= :endTime) OR (a.apptTime >= :startTime AND a.apptEndTime <= :endTime))")
    long countOverlappingAppointments(
            @Param("doctorId") UUID doctorId,
            @Param("apptDate") LocalDate apptDate,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime);
}
