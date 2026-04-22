package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.StaffShiftDTO;
import com.zenlocare.HMS_backend.dto.StaffShiftRequest;
import com.zenlocare.HMS_backend.service.StaffShiftService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/shifts")
@RequiredArgsConstructor
public class StaffShiftController {

    private final StaffShiftService shiftService;

    @GetMapping
    public ResponseEntity<List<StaffShiftDTO>> getWeekShifts(
            @RequestParam UUID hospitalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return ResponseEntity.ok(shiftService.getWeekShifts(hospitalId, weekStart));
    }

    @GetMapping("/monthly")
    public ResponseEntity<List<StaffShiftDTO>> getMonthShifts(
            @RequestParam UUID hospitalId,
            @RequestParam int year,
            @RequestParam int month) {
        return ResponseEntity.ok(shiftService.getMonthShifts(hospitalId, year, month));
    }

    @PostMapping
    public ResponseEntity<StaffShiftDTO> assignShift(@RequestBody StaffShiftRequest request) {
        return ResponseEntity.ok(shiftService.assignShift(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> removeShift(@PathVariable Long id) {
        shiftService.removeShift(id);
        return ResponseEntity.noContent().build();
    }
}
