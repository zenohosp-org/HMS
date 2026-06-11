package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.OtBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OtBookingRepository extends JpaRepository<OtBooking, UUID> {
    boolean existsByRoomIdAndStatusNotIn(Long roomId, List<String> statuses);
}
