package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.Patient;
import com.zenlocare.HMS_backend.service.PatientService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService patientService;

    @GetMapping
    public ResponseEntity<List<Patient>> listPatients(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(patientService.getPatientsByHospital(hospitalId));
    }

    @GetMapping("/search")
    public ResponseEntity<List<Patient>> searchPatients(
            @RequestParam UUID hospitalId,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(patientService.searchPatients(hospitalId, q));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Patient> getPatient(@PathVariable Integer id, @RequestParam UUID hospitalId) {
        return ResponseEntity.ok(patientService.getPatientById(id, hospitalId));
    }

    @PostMapping
    public ResponseEntity<Patient> createPatient(@RequestBody CreatePatientRequest req) {
        Patient p = patientService.createPatient(
                req.getHospitalId(), req.getFirstName(), req.getLastName(),
                req.getDob(), req.getGender(), req.getPhone(), req.getEmail(),
                req.getBloodGroup(), req.getAddress(), req.getAadhaarNumber());
        return ResponseEntity.ok(p);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Patient> updatePatient(@PathVariable Integer id, @RequestBody CreatePatientRequest req) {
        Patient p = patientService.updatePatient(id, req.getHospitalId(), req.getFirstName(), req.getLastName(),
                req.getDob(), req.getGender(), req.getPhone(), req.getEmail(),
                req.getBloodGroup(), req.getAddress(), req.getAadhaarNumber());
        return ResponseEntity.ok(p);
    }

    @Data
    public static class CreatePatientRequest {
        private UUID hospitalId;
        private String firstName;
        private String lastName;
        private LocalDate dob;
        private String gender;
        private String phone;
        private String email;
        private String bloodGroup;
        private String address;
        private String aadhaarNumber;
    }
}
