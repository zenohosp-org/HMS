package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.PayrollRecordDTO;
import com.zenlocare.HMS_backend.dto.ProcessSalaryRequest;
import com.zenlocare.HMS_backend.dto.StaffPayrollDTO;
import com.zenlocare.HMS_backend.service.PayrollService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
public class PayrollController {

    private final PayrollService payrollService;

    @GetMapping("/staff")
    public ResponseEntity<List<StaffPayrollDTO>> listStaff(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(payrollService.listStaffWithSalaries(hospitalId));
    }

    @PutMapping("/staff/{staffId}/salary")
    public ResponseEntity<Void> updateSalary(
            @PathVariable UUID staffId,
            @RequestParam UUID hospitalId,
            @RequestBody Map<String, BigDecimal> body) {
        payrollService.updateSalary(hospitalId, staffId, body.get("basicSalary"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/process")
    public ResponseEntity<PayrollRecordDTO> process(
            @RequestBody ProcessSalaryRequest request,
            Authentication auth) {
        return ResponseEntity.ok(payrollService.processSalary(request, auth));
    }

    @GetMapping("/records")
    public ResponseEntity<List<PayrollRecordDTO>> records(
            @RequestParam UUID hospitalId,
            @RequestParam int month,
            @RequestParam int year) {
        return ResponseEntity.ok(payrollService.getRecords(hospitalId, month, year));
    }
}
