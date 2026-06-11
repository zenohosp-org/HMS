package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Bed;
import com.zenlocare.HMS_backend.entity.BedStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BedRepository extends JpaRepository<Bed, Long> {
    List<Bed> findByRoomIdOrderByBedNumberAsc(Long roomId);

    @Query("SELECT b FROM Bed b LEFT JOIN b.room r LEFT JOIN r.hospitalWard rw LEFT JOIN b.ward w LEFT JOIN w.floor f LEFT JOIN f.building bl " +
           "WHERE (r.hospital.id = :hospitalId OR bl.hospital.id = :hospitalId) " +
           "AND b.status = :status " +
           "AND b.isActive = true " +
           "AND (r IS NULL OR (r.isActive = true AND rw IS NOT NULL AND rw.isActive = true)) " +
           "AND (w IS NULL OR w.isActive = true)")
    List<Bed> fetchAvailableBeds(@Param("hospitalId") java.util.UUID hospitalId, @Param("status") BedStatus status);

    @Query("SELECT b FROM Bed b LEFT JOIN b.room r LEFT JOIN r.hospitalWard rw LEFT JOIN b.ward w LEFT JOIN w.floor f LEFT JOIN f.building bl " +
           "WHERE (r.hospital.id = :hospitalId OR bl.hospital.id = :hospitalId) " +
           "AND b.isActive = true " +
           "AND (r IS NULL OR (r.isActive = true AND rw IS NOT NULL AND rw.isActive = true)) " +
           "AND (w IS NULL OR w.isActive = true)")
    List<Bed> fetchAllActiveBeds(@Param("hospitalId") java.util.UUID hospitalId);

    List<Bed> findByWardIdOrderByBedNumberAsc(Long wardId);
    long countByRoomIdAndStatus(Long roomId, BedStatus status);
    long countByWardIdAndStatus(Long wardId, BedStatus status);
    long countByRoomId(Long roomId);
    long countByWardId(Long wardId);
    Optional<Bed> findFirstByRoomIdAndStatus(Long roomId, BedStatus status);
    Optional<Bed> findFirstByWardIdAndStatus(Long wardId, BedStatus status);
    Optional<Bed> findByCurrentPatientId(Integer patientId);
}
