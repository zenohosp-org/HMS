package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.controller.PatientController.CreatePatientRequest;
import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.Patient;
import com.zenlocare.HMS_backend.exception.ResourceNotFoundException;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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

    public Patient createPatient(CreatePatientRequest req) {
        Hospital hospital = hospitalRepository.findById(req.getHospitalId())
                .orElseThrow(() -> new ResourceNotFoundException("Hospital not found"));

        long count = patientRepository.countByHospitalId(req.getHospitalId());
        String mrn = "MRN-" + String.format("%04d", count + 1);

        Patient patient = Patient.builder()
                .hospital(hospital)
                .mrn(mrn)
                .firstName(req.getFirstName())
                .lastName(req.getLastName())
                .dob(req.getDob())
                .gender(req.getGender())
                .phone(req.getPhone())
                .email(req.getEmail())
                .bloodGroup(req.getBloodGroup())
                .address(req.getAddress())
                .state(req.getState())
                .aadhaarNumber(req.getAadhaarNumber() != null ? req.getAadhaarNumber().replaceAll("\\D", "") : null)
                .maritalStatus(req.getMaritalStatus())
                .occupation(req.getOccupation())
                .emergencyContactName(req.getEmergencyContactName())
                .emergencyContactPhone(req.getEmergencyContactPhone())
                .emergencyContactRelation(req.getEmergencyContactRelation())
                .insuranceScheme(req.getInsuranceScheme())
                .insurancePolicyNumber(req.getInsurancePolicyNumber())
                .allergies(req.getAllergies())
                .chronicConditions(req.getChronicConditions())
                .referredBy(req.getReferredBy())
                .build();

        return patientRepository.save(patient);
    }

    public Patient updatePatient(Integer patientId, CreatePatientRequest req) {
        Patient patient = getPatientById(patientId, req.getHospitalId());
        if (req.getFirstName() != null) patient.setFirstName(req.getFirstName());
        if (req.getLastName() != null) patient.setLastName(req.getLastName());
        if (req.getDob() != null) patient.setDob(req.getDob());
        if (req.getGender() != null) patient.setGender(req.getGender());
        if (req.getPhone() != null) patient.setPhone(req.getPhone());
        if (req.getEmail() != null) patient.setEmail(req.getEmail());
        if (req.getBloodGroup() != null) patient.setBloodGroup(req.getBloodGroup());
        if (req.getAddress() != null) patient.setAddress(req.getAddress());
        patient.setState(req.getState());
        patient.setAadhaarNumber(req.getAadhaarNumber() != null ? req.getAadhaarNumber().replaceAll("\\D", "") : null);
        patient.setMaritalStatus(req.getMaritalStatus());
        patient.setOccupation(req.getOccupation());
        patient.setEmergencyContactName(req.getEmergencyContactName());
        patient.setEmergencyContactPhone(req.getEmergencyContactPhone());
        patient.setEmergencyContactRelation(req.getEmergencyContactRelation());
        patient.setInsuranceScheme(req.getInsuranceScheme());
        patient.setInsurancePolicyNumber(req.getInsurancePolicyNumber());
        patient.setAllergies(req.getAllergies());
        patient.setChronicConditions(req.getChronicConditions());
        patient.setReferredBy(req.getReferredBy());
        return patientRepository.save(patient);
    }
}
