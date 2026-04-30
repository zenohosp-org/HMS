package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.Asset;
import com.zenlocare.HMS_backend.entity.Room;
import com.zenlocare.HMS_backend.repository.AssetRepository;
import com.zenlocare.HMS_backend.repository.RoomRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
public class AssetRoomController {

    private final AssetRepository assetRepo;
    private final RoomRepository roomRepo;

    @GetMapping("/room/{roomId}")
    public ResponseEntity<List<Asset>> getByRoom(@PathVariable Long roomId,
                                                  @RequestParam UUID hospitalId) {
        return ResponseEntity.ok(assetRepo.findByHospitalIdAndRoomId(hospitalId, roomId));
    }

    @GetMapping("/available")
    public ResponseEntity<List<Asset>> getAvailable(@RequestParam UUID hospitalId,
                                                     @RequestParam(required = false) String q) {
        if (q != null && !q.isBlank()) {
            return ResponseEntity.ok(assetRepo.searchAvailableForRoom(hospitalId, q.trim()));
        }
        return ResponseEntity.ok(assetRepo.findAvailableForRoom(hospitalId));
    }

    @PatchMapping("/{assetId}/assign-room")
    public ResponseEntity<Asset> assignToRoom(@PathVariable UUID assetId,
                                               @RequestBody AssignRequest req) {
        return assetRepo.findById(assetId).map(asset -> {
            Room room = roomRepo.findById(req.getRoomId()).orElse(null);
            asset.setRoomId(req.getRoomId());
            asset.setAssignedToType("ROOM");
            asset.setAssignedTo(req.getHospitalId());
            asset.setFloor(room != null && room.getHospitalWard() != null
                    ? room.getHospitalWard().getFloor() != null
                        ? room.getHospitalWard().getFloor().getDisplayOrder().shortValue()
                        : null
                    : null);
            asset.setAssignedAt(LocalDateTime.now());
            return ResponseEntity.ok(assetRepo.save(asset));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{assetId}/unassign-room")
    public ResponseEntity<Asset> unassignFromRoom(@PathVariable UUID assetId) {
        return assetRepo.findById(assetId).map(asset -> {
            asset.setRoomId(null);
            asset.setAssignedToType(null);
            asset.setAssignedTo(null);
            asset.setFloor(null);
            asset.setAssignedAt(null);
            return ResponseEntity.ok(assetRepo.save(asset));
        }).orElse(ResponseEntity.notFound().build());
    }

    @Data
    public static class AssignRequest {
        private Long roomId;
        private UUID hospitalId;
    }
}
