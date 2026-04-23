package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.Patient;
import com.zenlocare.HMS_backend.exception.ResourceNotFoundException;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PatientService {

    private final PatientRepository patientRepository;
    private final HospitalRepository hospitalRepository;

    public List<Patient> getPatientsByHospital(UUID hospitalId) {
        return patientRepository.findByHospitalId(hospitalId);
    }

    public List<Patient> searchPatients(UUID hospitalId, String query) {
        if (query == null || query.trim().isEmpty()) {
            return patientRepository.findByHospitalId(hospitalId);
        }

        // Use pagination request to limit to top 20 results for performance
        org.springframework.data.domain.Pageable limit = org.springframework.data.domain.PageRequest.of(0, 20);
        return patientRepository.searchPatients(hospitalId, query.trim(), limit);
    }

    public Patient getPatientById(Integer patientId, UUID hospitalId) {
        return patientRepository.findByIdAndHospitalId(patientId, hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found"));
    }

    public Patient createPatient(UUID hospitalId, String firstName, String lastName, LocalDate dob,
            String gender, String phone, String email, String bloodGroup, String address, String aadhaarNumber) {

        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Hospital not found"));

        long count = patientRepository.countByHospitalId(hospitalId);
        String mrn = "MRN-" + String.format("%04d", count + 1);

        Patient patient = Patient.builder()
                .hospital(hospital)
                .mrn(mrn)
                .firstName(firstName)
                .lastName(lastName)
                .dob(dob)
                .gender(gender)
                .phone(phone)
                .email(email)
                .bloodGroup(bloodGroup)
                .address(address)
                .aadhaarNumber(aadhaarNumber != null ? aadhaarNumber.replaceAll("\\D", "") : null)
                .build();

        return patientRepository.save(patient);
    }

    public Patient updatePatient(Integer patientId, UUID hospitalId, String firstName, String lastName,
            LocalDate dob, String gender, String phone, String email, String bloodGroup, String address,
            String aadhaarNumber) {

        Patient patient = getPatientById(patientId, hospitalId);
        if (firstName != null) patient.setFirstName(firstName);
        if (lastName != null) patient.setLastName(lastName);
        if (dob != null) patient.setDob(dob);
        if (gender != null) patient.setGender(gender);
        if (phone != null) patient.setPhone(phone);
        if (email != null) patient.setEmail(email);
        if (bloodGroup != null) patient.setBloodGroup(bloodGroup);
        if (address != null) patient.setAddress(address);
        patient.setAadhaarNumber(aadhaarNumber != null ? aadhaarNumber.replaceAll("\\D", "") : null);
        return patientRepository.save(patient);
    }
}
