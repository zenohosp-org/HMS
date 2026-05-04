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
    long countByRoomIdAndStatus(Long roomId, BedStatus status);
    long countByRoomId(Long roomId);
    Optional<Bed> findFirstByRoomIdAndStatus(Long roomId, BedStatus status);
    Optional<Bed> findByCurrentPatientId(Integer patientId);
}
