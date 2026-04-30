package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.AttenderUpdateRequest;
import com.zenlocare.HMS_backend.dto.RoomAllocationRequest;
import com.zenlocare.HMS_backend.dto.RoomCreateRequest;
import com.zenlocare.HMS_backend.dto.RoomLogDTO;
import com.zenlocare.HMS_backend.entity.Room;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @GetMapping
    @PreAuthorize("hasAnyRole('hospital_admin', 'doctor', 'staff')")
    public ResponseEntity<List<Room>> getRoomsForHospital(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(roomService.getRoomsForHospital(hospitalId));
    }

    @PostMapping("/generate")
    @PreAuthorize("hasRole('hospital_admin')")
    public ResponseEntity<List<Room>> generateRooms(@RequestBody RoomCreateRequest request,
            Authentication auth) {
        return ResponseEntity.ok(roomService.generateRooms(request, resolveFullName(auth)));
    }

    @PostMapping("/allocate")
    @PreAuthorize("hasAnyRole('hospital_admin', 'doctor', 'staff')")
    public ResponseEntity<Room> allocatePatient(@RequestBody RoomAllocationRequest request,
            @RequestParam UUID hospitalId, Authentication auth) {
        return ResponseEntity.ok(roomService.allocatePatient(request, hospitalId, resolveFullName(auth)));
    }

    @PatchMapping("/{roomId}/attender")
    @PreAuthorize("hasAnyRole('hospital_admin', 'doctor', 'staff')")
    public ResponseEntity<Room> updateAttender(@PathVariable Long roomId,
            @RequestBody AttenderUpdateRequest request,
            @RequestParam UUID hospitalId, Authentication auth) {
        return ResponseEntity.ok(roomService.updateAttender(roomId, request, hospitalId, resolveFullName(auth)));
    }

    @PostMapping("/{roomId}/deallocate")
    @PreAuthorize("hasAnyRole('hospital_admin', 'doctor', 'staff')")
    public ResponseEntity<Room> deallocatePatient(@PathVariable Long roomId,
            @RequestParam UUID hospitalId, Authentication auth) {
        return ResponseEntity.ok(roomService.deallocatePatient(roomId, hospitalId, resolveFullName(auth)));
    }

    @DeleteMapping("/{roomId}")
    @PreAuthorize("hasRole('hospital_admin')")
    public ResponseEntity<Void> deleteRoom(@PathVariable Long roomId,
            @RequestParam UUID hospitalId) {
        roomService.deleteRoom(roomId, hospitalId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/logs")
    @PreAuthorize("hasAnyRole('hospital_admin', 'doctor', 'staff')")
    public ResponseEntity<List<RoomLogDTO>> getHospitalLogs(@RequestParam UUID hospitalId,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(roomService.getHospitalLogs(hospitalId, search));
    }

    @GetMapping("/{roomId}/logs")
    @PreAuthorize("hasAnyRole('hospital_admin', 'doctor', 'staff')")
    public ResponseEntity<List<RoomLogDTO>> getRoomLogs(@PathVariable Long roomId,
            @RequestParam UUID hospitalId) {
        return ResponseEntity.ok(roomService.getRoomLogs(roomId, hospitalId));
    }

    private String resolveFullName(Authentication auth) {
        if (auth != null && auth.getPrincipal() instanceof User user) {
            return user.getFirstName() + " " + user.getLastName();
        }
        return "System";
    }
}
