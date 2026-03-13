package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Room;
import com.zenlocare.HMS_backend.entity.RoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {

    List<Room> findByHospitalId(UUID hospitalId);

    List<Room> findByHospitalIdAndStatus(UUID hospitalId, RoomStatus status);

    Optional<Room> findByHospitalIdAndRoomNumber(UUID hospitalId, String roomNumber);

    Optional<Room> findByCurrentPatientId(Integer patientId);

    boolean existsByHospitalId(UUID hospitalId);
}
