package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.RoomLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RoomLogRepository extends JpaRepository<RoomLog, Long> {

    List<RoomLog> findByHospitalIdOrderByCreatedAtDesc(UUID hospitalId);

    List<RoomLog> findByRoomIdOrderByCreatedAtDesc(Long roomId);

    @Query("SELECT l FROM RoomLog l WHERE l.hospital.id = :hospitalId AND (" +
           "LOWER(l.roomNumber)   LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.patientName)  LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.patientMrn)   LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.attenderName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.performedBy)  LIKE LOWER(CONCAT('%', :search, '%')))" +
           " ORDER BY l.createdAt DESC")
    List<RoomLog> searchByHospital(@Param("hospitalId") UUID hospitalId, @Param("search") String search);
}
