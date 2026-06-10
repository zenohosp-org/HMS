package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Bed;
import com.zenlocare.HMS_backend.entity.BedStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BedRepository extends JpaRepository<Bed, Long> {
    List<Bed> findByRoomIdOrderByBedNumberAsc(Long roomId);
    List<Bed> findByWardIdOrderByBedNumberAsc(Long wardId);
    long countByRoomIdAndStatus(Long roomId, BedStatus status);
    long countByWardIdAndStatus(Long wardId, BedStatus status);
    long countByRoomId(Long roomId);
    long countByWardId(Long wardId);
    Optional<Bed> findFirstByRoomIdAndStatus(Long roomId, BedStatus status);
    Optional<Bed> findFirstByWardIdAndStatus(Long wardId, BedStatus status);
    Optional<Bed> findByCurrentPatientId(Integer patientId);
}
