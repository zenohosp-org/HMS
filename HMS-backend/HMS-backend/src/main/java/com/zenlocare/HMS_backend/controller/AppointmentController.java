package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.AppointmentDto;
import com.zenlocare.HMS_backend.dto.AppointmentRequest;
import com.zenlocare.HMS_backend.entity.Appointment;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.service.AppointmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentService appointmentService;

    @GetMapping("/hospital/{hospitalId}")
    public ResponseEntity<List<AppointmentDto>> getHospitalAppointments(
            @PathVariable UUID hospitalId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(appointmentService.getAppointmentsByHospital(hospitalId, date));
    }

    @GetMapping("/doctor/{doctorId}")
    public ResponseEntity<List<AppointmentDto>> getDoctorAppointments(
            @PathVariable UUID doctorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(appointmentService.getAppointmentsByDoctor(doctorId, date));
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<AppointmentDto>> getPatientAppointments(@PathVariable Integer patientId) {
        return ResponseEntity.ok(appointmentService.getAppointmentsByPatient(patientId));
    }

    @PostMapping
    public ResponseEntity<AppointmentDto> createAppointment(
            @RequestBody AppointmentRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(appointmentService.createAppointment(request, currentUser.getId()));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<AppointmentDto> updateAppointmentStatus(
            @PathVariable UUID id,
            @RequestBody AppointmentRequest request) {
        return ResponseEntity
                .ok(appointmentService.updateAppointmentStatus(id, request.getStatus(), request.getCancelledReason()));
    }
}
