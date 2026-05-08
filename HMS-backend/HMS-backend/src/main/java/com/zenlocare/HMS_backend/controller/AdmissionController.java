package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.AdmissionDTO;
import com.zenlocare.HMS_backend.dto.AdmissionRequest;
import com.zenlocare.HMS_backend.dto.DischargeRequest;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.service.AdmissionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
    public ResponseEntity<AdmissionDTO> admit(@RequestBody AdmissionRequest req, Authentication auth) {
        return ResponseEntity.ok(admissionService.admit(req, resolveFullName(auth)));
    }

    @PatchMapping("/{id}/assign-room")
    public ResponseEntity<AdmissionDTO> assignRoom(@PathVariable UUID id,
                                                    @RequestBody RoomAssignRequest req,
                                                    Authentication auth) {
        return ResponseEntity.ok(admissionService.assignRoom(id, req.getRoomId(), resolveFullName(auth)));
    }

    @PatchMapping("/{id}/discharge")
    public ResponseEntity<AdmissionDTO> discharge(@PathVariable UUID id,
                                                   @RequestBody DischargeRequest req,
                                                   Authentication auth) {
        return ResponseEntity.ok(admissionService.discharge(id, req, resolveFullName(auth)));
    }

    @PatchMapping("/{id}/move-to-ot")
    public ResponseEntity<AdmissionDTO> moveToOT(@PathVariable UUID id,
                                                  @RequestBody MoveToOTRequest req,
                                                  Authentication auth) {
        return ResponseEntity.ok(admissionService.moveToOT(id, req.getRoomId(), req.getDoctorId(), req.getOtBookingId(), resolveFullName(auth)));
    }

    @PatchMapping("/{id}/return-from-ot")
    public ResponseEntity<AdmissionDTO> returnFromOT(@PathVariable UUID id,
                                                      @RequestBody(required = false) ReturnFromOTRequest req,
                                                      Authentication auth) {
        Long postOtRoomId = req != null ? req.getPostOtRoomId() : null;
        return ResponseEntity.ok(admissionService.returnFromOT(id, postOtRoomId, resolveFullName(auth)));
    }

    @PatchMapping("/{id}/return-to-ward")
    public ResponseEntity<AdmissionDTO> returnToWard(@PathVariable UUID id, Authentication auth) {
        return ResponseEntity.ok(admissionService.returnToWard(id, resolveFullName(auth)));
    }

    private String resolveFullName(Authentication auth) {
        if (auth != null && auth.getPrincipal() instanceof User user) {
            return user.getFirstName() + " " + user.getLastName();
        }
        return "Unknown";
    }

    @Data
    public static class RoomAssignRequest {
        private Long roomId;
    }

    @Data
    public static class MoveToOTRequest {
        private Long roomId;
        private UUID doctorId;
        private UUID otBookingId;
    }

    @Data
    public static class ReturnFromOTRequest {
        private Long postOtRoomId;
    }
}
