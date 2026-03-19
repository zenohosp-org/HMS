package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.Doctor;
import com.zenlocare.HMS_backend.service.DoctorService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/doctors")
@RequiredArgsConstructor
public class DoctorController {

    private final DoctorService doctorService;

    @GetMapping
    public ResponseEntity<List<DoctorDto>> listDoctors(@RequestParam UUID hospitalId) {
        List<Doctor> doctors = doctorService.getDoctorsByHospital(hospitalId);
        List<DoctorDto> dtos = doctors.stream().map(this::mapToDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DoctorDto> getDoctor(@PathVariable UUID id) {
        Doctor doctor = doctorService.getDoctorById(id);
        return ResponseEntity.ok(mapToDto(doctor));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<DoctorDto> getDoctorByUserId(@PathVariable UUID userId) {
        Doctor doctor = doctorService.getDoctorByUserId(userId);
        return ResponseEntity.ok(mapToDto(doctor));
    }

    @PostMapping
    @PreAuthorize("hasRole('hospital_admin')")
    public ResponseEntity<DoctorDto> createDoctor(@RequestBody CreateDoctorRequest req) {
        Doctor doctorData = new Doctor();
        doctorData.setSpecialization(req.getSpecialization());
        doctorData.setQualification(req.getQualification());
        doctorData.setMedicalRegistrationNumber(req.getMedicalRegistrationNumber());
        doctorData.setRegistrationCouncil(req.getRegistrationCouncil());
        doctorData.setConsultationFee(req.getConsultationFee());
        doctorData.setFollowUpFee(req.getFollowUpFee());
        doctorData.setAvailableDays(req.getAvailableDays());
        doctorData.setSlotDurationMin(req.getSlotDurationMin());
        doctorData.setMaxDailySlots(req.getMaxDailySlots());

        Doctor doctor = doctorService.createDoctor(req.getUserId(), req.getHospitalId(), doctorData);
        return ResponseEntity.ok(mapToDto(doctor));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('hospital_admin') or hasRole('doctor')")
    public ResponseEntity<DoctorDto> updateDoctor(@PathVariable UUID id, @RequestBody DoctorDto req) {
        Doctor updatedData = new Doctor();
        updatedData.setSpecialization(req.getSpecialization());
        updatedData.setQualification(req.getQualification());
        updatedData.setMedicalRegistrationNumber(req.getMedicalRegistrationNumber());
        updatedData.setRegistrationCouncil(req.getRegistrationCouncil());
        updatedData.setConsultationFee(req.getConsultationFee());
        updatedData.setFollowUpFee(req.getFollowUpFee());
        updatedData.setAvailableDays(req.getAvailableDays());
        updatedData.setSlotDurationMin(req.getSlotDurationMin());
        updatedData.setMaxDailySlots(req.getMaxDailySlots());

        Doctor doctor = doctorService.updateDoctor(id, updatedData);
        return ResponseEntity.ok(mapToDto(doctor));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('hospital_admin')")
    public ResponseEntity<Void> deleteDoctor(@PathVariable UUID id) {
        doctorService.deleteDoctor(id);
        return ResponseEntity.noContent().build();
    }

    private DoctorDto mapToDto(Doctor doctor) {
        DoctorDto dto = new DoctorDto();
        dto.setId(doctor.getId().toString());
        dto.setUserId(doctor.getUser().getId().toString());
        dto.setHospitalId(doctor.getHospital().getId().toString());

        dto.setFirstName(doctor.getUser().getFirstName());
        dto.setLastName(doctor.getUser().getLastName());
        dto.setEmail(doctor.getUser().getEmail());
        dto.setPhone(doctor.getUser().getPhone());
        dto.setUserIsActive(doctor.getUser().getIsActive());

        dto.setSpecialization(doctor.getSpecialization());
        dto.setQualification(doctor.getQualification());
        dto.setMedicalRegistrationNumber(doctor.getMedicalRegistrationNumber());
        dto.setRegistrationCouncil(doctor.getRegistrationCouncil());
        dto.setConsultationFee(doctor.getConsultationFee());
        dto.setFollowUpFee(doctor.getFollowUpFee());
        dto.setAvailableDays(doctor.getAvailableDays());
        dto.setSlotDurationMin(doctor.getSlotDurationMin());
        dto.setMaxDailySlots(doctor.getMaxDailySlots());

        return dto;
    }

    @Data
    public static class CreateDoctorRequest {
        private UUID userId;
        private UUID hospitalId;
        private String specialization;
        private String qualification;
        private String medicalRegistrationNumber;
        private String registrationCouncil;
        private BigDecimal consultationFee;
        private BigDecimal followUpFee;
        private String availableDays;
        private Integer slotDurationMin;
        private Integer maxDailySlots;
    }

    @Data
    public static class DoctorDto {
        private String id;
        private String userId;
        private String hospitalId;

        // Joined user fields for convenience display
        private String firstName;
        private String lastName;
        private String email;
        private String phone;
        private Boolean userIsActive;

        private String specialization;
        private String qualification;
        private String medicalRegistrationNumber;
        private String registrationCouncil;
        private BigDecimal consultationFee;
        private BigDecimal followUpFee;
        private String availableDays;
        private Integer slotDurationMin;
        private Integer maxDailySlots;
    }
}
