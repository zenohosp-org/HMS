package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.GstRateDTO;
import com.zenlocare.HMS_backend.dto.GstRateRequest;
import com.zenlocare.HMS_backend.service.GstRateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/gst-rates")
@RequiredArgsConstructor
public class GstRateController {

    private final GstRateService gstRateService;

    @GetMapping
    public ResponseEntity<List<GstRateDTO>> getAll(@RequestParam UUID hospitalId,
                                                     @RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(activeOnly
                ? gstRateService.getActive(hospitalId)
                : gstRateService.getAll(hospitalId));
    }

    @PostMapping
    public ResponseEntity<GstRateDTO> create(@RequestBody GstRateRequest req) {
        return ResponseEntity.ok(gstRateService.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GstRateDTO> update(@PathVariable UUID id, @RequestBody GstRateRequest req) {
        return ResponseEntity.ok(gstRateService.update(id, req));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<GstRateDTO> toggle(@PathVariable UUID id) {
        return ResponseEntity.ok(gstRateService.toggle(id));
    }

    @PatchMapping("/{id}/set-default")
    public ResponseEntity<GstRateDTO> setDefault(@PathVariable UUID id) {
        return ResponseEntity.ok(gstRateService.setDefault(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        gstRateService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
