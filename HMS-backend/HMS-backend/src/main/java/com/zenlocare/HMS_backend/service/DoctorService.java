package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.Doctor;
import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.User;
import com.zenlocare.HMS_backend.exception.ResourceNotFoundException;
import com.zenlocare.HMS_backend.exception.ConflictException;
import com.zenlocare.HMS_backend.repository.DoctorRepository;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Transactional(readOnly = true)
@Service
@RequiredArgsConstructor
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;
    private final HospitalRepository hospitalRepository;

    public List<Doctor> getDoctorsByHospital(UUID hospitalId) {
        return doctorRepository.findByHospitalId(hospitalId);
    }

    public List<Doctor> getDoctorsByHospitalAndSpecialization(UUID hospitalId, String specialization) {
        return doctorRepository.findByHospitalIdAndSpecialization(hospitalId, specialization);
    }

    public Doctor getDoctorById(UUID id) {
        return doctorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));
    }

    public Doctor getDoctorByUserId(UUID userId) {
        return doctorRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found for user: " + userId));
    }

    @Transactional
    public Doctor createDoctor(UUID userId, UUID hospitalId, Doctor doctorData) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        if (!"doctor".equalsIgnoreCase(user.getRole().getName())) {
            throw new ConflictException("User does not have the doctor role");
        }

        if (doctorRepository.findByUserId(userId).isPresent()) {
            throw new ConflictException("Doctor profile already exists for this user");
        }

        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new ResourceNotFoundException("Hospital not found"));

        Doctor doctor = Doctor.builder()
                .user(user)
                .hospital(hospital)
                .specialization(doctorData.getSpecialization())
                .qualification(doctorData.getQualification())
                .medicalRegistrationNumber(doctorData.getMedicalRegistrationNumber())
                .registrationCouncil(doctorData.getRegistrationCouncil())
                .consultationFee(doctorData.getConsultationFee())
                .followUpFee(doctorData.getFollowUpFee())
                .availableDays(doctorData.getAvailableDays())
                .slotDurationMin(doctorData.getSlotDurationMin() != null ? doctorData.getSlotDurationMin() : 15)
                .maxDailySlots(doctorData.getMaxDailySlots())
                .workPhone(doctorData.getWorkPhone())
                .personalPhone(doctorData.getPersonalPhone())
                .workEmail(doctorData.getWorkEmail())
                .personalEmail(doctorData.getPersonalEmail())
                .workAddress(doctorData.getWorkAddress())
                .residentialAddress(doctorData.getResidentialAddress())
                .build();

        return doctorRepository.save(doctor);
    }

    @Transactional
    public Doctor updateDoctor(UUID id, Doctor updatedData) {
        Doctor doctor = getDoctorById(id);

        if (updatedData.getSpecialization() != null)
            doctor.setSpecialization(updatedData.getSpecialization());
        if (updatedData.getQualification() != null)
            doctor.setQualification(updatedData.getQualification());
        if (updatedData.getMedicalRegistrationNumber() != null)
            doctor.setMedicalRegistrationNumber(updatedData.getMedicalRegistrationNumber());
        if (updatedData.getRegistrationCouncil() != null)
            doctor.setRegistrationCouncil(updatedData.getRegistrationCouncil());
        if (updatedData.getConsultationFee() != null)
            doctor.setConsultationFee(updatedData.getConsultationFee());
        if (updatedData.getFollowUpFee() != null)
            doctor.setFollowUpFee(updatedData.getFollowUpFee());
        if (updatedData.getAvailableDays() != null)
            doctor.setAvailableDays(updatedData.getAvailableDays());
        if (updatedData.getSlotDurationMin() != null)
            doctor.setSlotDurationMin(updatedData.getSlotDurationMin());
        if (updatedData.getMaxDailySlots() != null)
            doctor.setMaxDailySlots(updatedData.getMaxDailySlots());
        if (updatedData.getWorkPhone() != null)
            doctor.setWorkPhone(updatedData.getWorkPhone());
        if (updatedData.getPersonalPhone() != null)
            doctor.setPersonalPhone(updatedData.getPersonalPhone());
        if (updatedData.getWorkEmail() != null)
            doctor.setWorkEmail(updatedData.getWorkEmail());
        if (updatedData.getPersonalEmail() != null)
            doctor.setPersonalEmail(updatedData.getPersonalEmail());
        if (updatedData.getWorkAddress() != null)
            doctor.setWorkAddress(updatedData.getWorkAddress());
        if (updatedData.getResidentialAddress() != null)
            doctor.setResidentialAddress(updatedData.getResidentialAddress());

        return doctorRepository.save(doctor);
    }

    @Transactional
    public void deleteDoctor(UUID id) {
        Doctor doctor = getDoctorById(id);
        doctorRepository.delete(doctor);
    }
}
