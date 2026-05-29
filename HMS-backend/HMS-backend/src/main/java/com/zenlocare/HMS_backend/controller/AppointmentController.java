package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.AppointmentDto;
import com.zenlocare.HMS_backend.dto.AppointmentRequest;
import com.zenlocare.HMS_backend.entity.Appointment;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.service.AppointmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
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

    @GetMapping("/paginated")
    public ResponseEntity<Page<AppointmentDto>> getPaginatedAppointments(
            @RequestParam UUID hospitalId,
            @RequestParam(required = false) UUID doctorId,
            @RequestParam(required = false, defaultValue = "ALL") String dateFilter,
            @RequestParam(required = false, defaultValue = "") String search,
            @PageableDefault(size = 10) Pageable pageable) {
        return ResponseEntity.ok(appointmentService.getPaginatedAppointments(
                hospitalId, doctorId, dateFilter, search, pageable));
    }

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

    @GetMapping("/patient/{patientId}/past-doctors")
    public ResponseEntity<List<AppointmentDto>> getPastDoctors(
            @PathVariable Integer patientId,
            @RequestParam UUID hospitalId) {
        return ResponseEntity.ok(appointmentService.getPastDoctorsForPatient(patientId, hospitalId));
    }

    /**
     * Single-appointment lookup. The print-consultation page opens in
     * a new tab and only knows the appointment id from the URL, so it
     * uses this to hydrate the patient + doctor + hospital header on
     * the print sheet.
     */
    @GetMapping("/{id}")
    public ResponseEntity<AppointmentDto> getAppointmentById(@PathVariable UUID id) {
        return ResponseEntity.ok(appointmentService.getAppointmentById(id));
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

    /**
     * Re-number today's queue from 1, in booking-time order. Returns how many
     * tokens were assigned so the UI can show "Renumbered N appointments".
     */
    @PostMapping("/refresh-tokens")
    public ResponseEntity<java.util.Map<String, Object>> refreshTokens(@RequestParam UUID hospitalId) {
        int count = appointmentService.refreshTokensForToday(hospitalId);
        return ResponseEntity.ok(java.util.Map.of("assigned", count));
    }
}
