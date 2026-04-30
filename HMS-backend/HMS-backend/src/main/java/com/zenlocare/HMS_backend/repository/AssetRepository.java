package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface AssetRepository extends JpaRepository<Asset, UUID> {

    List<Asset> findByHospitalIdAndRoomId(UUID hospitalId, Long roomId);

    // Assets not assigned to any room yet — available for room assignment
    @Query("SELECT a FROM Asset a WHERE a.hospitalId = :hospitalId AND a.roomId IS NULL AND a.status != 'DISPOSED' ORDER BY a.assetName ASC")
    List<Asset> findAvailableForRoom(UUID hospitalId);

    // Quick search within available assets
    @Query("SELECT a FROM Asset a WHERE a.hospitalId = :hospitalId AND a.roomId IS NULL AND a.status != 'DISPOSED' AND (LOWER(a.assetName) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(a.assetCode) LIKE LOWER(CONCAT('%', :q, '%')))")
    List<Asset> searchAvailableForRoom(UUID hospitalId, String q);
}
