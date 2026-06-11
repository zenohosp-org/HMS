package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.BloodBankDtos;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.service.BloodBankService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Blood-bank API. Lookup configuration, donor registry, bag inventory,
 * issuance + stats. Tenant scoping is enforced at the service layer via
 * hospitalId from the request.
 */
@RestController
@RequestMapping("/api/blood-bank")
@RequiredArgsConstructor
public class BloodBankController {

    private final BloodBankService service;

    // ───── Lookups ────────────────────────────────────────────────────

    @GetMapping("/lookups")
    public ResponseEntity<List<BloodBankDtos.LookupDto>> listLookups(
            @RequestParam UUID hospitalId,
            @RequestParam String type) {
        return ResponseEntity.ok(service.listLookups(hospitalId, type));
    }

    // ───── Donors ─────────────────────────────────────────────────────

    @GetMapping("/donors")
    public ResponseEntity<List<BloodBankDtos.DonorDto>> listDonors(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(service.listDonors(hospitalId));
    }

    @GetMapping("/donors/{id}")
    public ResponseEntity<BloodBankDtos.DonorDto> getDonor(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getDonor(id));
    }

    @PostMapping("/donors")
    public ResponseEntity<BloodBankDtos.DonorDto> registerDonor(
            @RequestParam UUID hospitalId,
            @RequestBody BloodBankDtos.DonorRequest req) {
        return ResponseEntity.ok(service.registerDonor(hospitalId, req));
    }

    @PutMapping("/donors/{id}")
    public ResponseEntity<BloodBankDtos.DonorDto> updateDonor(
            @PathVariable UUID id,
            @RequestBody BloodBankDtos.DonorRequest req) {
        return ResponseEntity.ok(service.updateDonor(id, req));
    }

    // ───── Units (inventory) ──────────────────────────────────────────

    @GetMapping("/units")
    public ResponseEntity<List<BloodBankDtos.UnitDto>> listUnits(
            @RequestParam UUID hospitalId,
            @RequestParam(required = false) String groupCode,
            @RequestParam(required = false) String componentCode,
            @RequestParam(required = false) String statusCode) {
        return ResponseEntity.ok(service.listUnits(hospitalId, groupCode, componentCode, statusCode));
    }

    @GetMapping("/units/{id}")
    public ResponseEntity<BloodBankDtos.UnitDto> getUnit(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getUnit(id));
    }

    @PostMapping("/units")
    public ResponseEntity<BloodBankDtos.UnitDto> registerUnit(
            @RequestParam UUID hospitalId,
            @RequestBody BloodBankDtos.UnitRequest req) {
        return ResponseEntity.ok(service.registerUnit(hospitalId, req));
    }

    @GetMapping("/units/next-bag-number")
    public ResponseEntity<java.util.Map<String, String>> nextBagNumber(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(java.util.Map.of("bagNumber", service.generateNextBagNumber(hospitalId)));
    }

    @PatchMapping("/units/{id}/status")
    public ResponseEntity<BloodBankDtos.UnitDto> updateStatus(
            @PathVariable UUID id,
            @RequestBody StatusRequest req) {
        return ResponseEntity.ok(service.updateUnitStatus(id, req.getStatusCode()));
    }

    @PostMapping("/units/{id}/issue")
    public ResponseEntity<BloodBankDtos.UnitDto> issueUnit(
            @PathVariable UUID id,
            @RequestBody BloodBankDtos.IssueUnitRequest req,
            Authentication auth) {
        UUID issuedBy = auth != null && auth.getPrincipal() instanceof User u ? u.getId() : null;
        return ResponseEntity.ok(service.issueUnit(id, req, issuedBy));
    }

    // ───── Stats ──────────────────────────────────────────────────────

    @GetMapping("/stats")
    public ResponseEntity<BloodBankDtos.StatsDto> getStats(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(service.getStats(hospitalId));
    }

    @lombok.Data
    public static class StatusRequest {
        private String statusCode;
    }
}
