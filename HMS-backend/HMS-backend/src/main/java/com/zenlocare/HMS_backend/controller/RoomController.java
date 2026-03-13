package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.RoomAllocationRequest;
import com.zenlocare.HMS_backend.dto.RoomCreateRequest;
import com.zenlocare.HMS_backend.entity.Room;
import com.zenlocare.HMS_backend.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @GetMapping
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'DOCTOR', 'STAFF')")
    public ResponseEntity<List<Room>> getRoomsForHospital(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(roomService.getRoomsForHospital(hospitalId));
    }

    @PostMapping("/generate")
    @PreAuthorize("hasRole('HOSPITAL_ADMIN')")
    public ResponseEntity<List<Room>> generateRooms(@RequestBody RoomCreateRequest request) {
        return ResponseEntity.ok(roomService.generateRooms(request));
    }

    @PostMapping("/allocate")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'DOCTOR', 'STAFF')")
    public ResponseEntity<Room> allocatePatient(@RequestBody RoomAllocationRequest request,
            @RequestParam UUID hospitalId) {
        return ResponseEntity.ok(roomService.allocatePatient(request, hospitalId));
    }

    @PostMapping("/{roomId}/deallocate")
    @PreAuthorize("hasAnyRole('HOSPITAL_ADMIN', 'DOCTOR', 'STAFF')")
    public ResponseEntity<Room> deallocatePatient(@PathVariable Long roomId, @RequestParam UUID hospitalId) {
        return ResponseEntity.ok(roomService.deallocatePatient(roomId, hospitalId));
    }
}
