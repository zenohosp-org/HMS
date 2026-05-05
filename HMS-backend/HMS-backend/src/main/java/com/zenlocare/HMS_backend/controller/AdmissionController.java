package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.AdmissionDTO;
import com.zenlocare.HMS_backend.dto.AdmissionRequest;
import com.zenlocare.HMS_backend.dto.DischargeRequest;
import com.zenlocare.HMS_backend.service.AdmissionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admissions")
@RequiredArgsConstructor
public class AdmissionController {

    private final AdmissionService admissionService;

    @GetMapping
    public ResponseEntity<List<AdmissionDTO>> list(@RequestParam UUID hospitalId,
                                                    @RequestParam(defaultValue = "false") boolean all) {
        return ResponseEntity.ok(all
                ? admissionService.getAll(hospitalId)
                : admissionService.getActive(hospitalId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdmissionDTO> get(@PathVariable UUID id) {
        return ResponseEntity.ok(admissionService.get(id));
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<AdmissionDTO>> byPatient(@PathVariable Integer patientId) {
        return ResponseEntity.ok(admissionService.getByPatient(patientId));
    }

    @PostMapping
    public ResponseEntity<AdmissionDTO> admit(@RequestBody AdmissionRequest req,
                                               @AuthenticationPrincipal UserDetails user) {
        String performedBy = user != null ? user.getUsername() : "system";
        return ResponseEntity.ok(admissionService.admit(req, performedBy));
    }

    @PatchMapping("/{id}/assign-room")
    public ResponseEntity<AdmissionDTO> assignRoom(@PathVariable UUID id,
                                                    @RequestBody RoomAssignRequest req,
                                                    @AuthenticationPrincipal UserDetails user) {
        String performedBy = user != null ? user.getUsername() : "system";
        return ResponseEntity.ok(admissionService.assignRoom(id, req.getRoomId(), performedBy));
    }

    @PatchMapping("/{id}/discharge")
    public ResponseEntity<AdmissionDTO> discharge(@PathVariable UUID id,
                                                   @RequestBody DischargeRequest req,
                                                   @AuthenticationPrincipal UserDetails user) {
        String performedBy = user != null ? user.getUsername() : "system";
        return ResponseEntity.ok(admissionService.discharge(id, req, performedBy));
    }

    @PatchMapping("/{id}/move-to-ot")
    public ResponseEntity<AdmissionDTO> moveToOT(@PathVariable UUID id,
                                                  @RequestBody MoveToOTRequest req,
                                                  @AuthenticationPrincipal UserDetails user) {
        String performedBy = user != null ? user.getUsername() : "system";
        return ResponseEntity.ok(admissionService.moveToOT(id, req.getRoomId(), req.getDoctorId(), performedBy));
    }

    @Data
    public static class RoomAssignRequest {
        private Long roomId;
    }

    @Data
    public static class MoveToOTRequest {
        private Long roomId;
        private UUID doctorId;
    }
}
