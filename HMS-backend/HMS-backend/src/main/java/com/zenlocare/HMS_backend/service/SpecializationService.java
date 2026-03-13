package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.Specialization;
import com.zenlocare.HMS_backend.repository.DoctorRepository;
import com.zenlocare.HMS_backend.repository.SpecializationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SpecializationService {

    private final SpecializationRepository specializationRepository;
    private final DoctorRepository doctorRepository;

    public List<Specialization> getSpecializationsByHospital(UUID hospitalId) {
        return specializationRepository.findByHospitalId(hospitalId);
    }

    public long getDoctorCount(UUID hospitalId, String specializationName) {
        return doctorRepository.countByHospitalIdAndSpecialization(hospitalId, specializationName);
    }

    @Transactional
    public Specialization createSpecialization(Specialization specialization) {
        return specializationRepository.save(specialization);
    }

    @Transactional
    public Specialization updateSpecialization(UUID id, Specialization specializationData) {
        Specialization specialization = specializationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Specialization not found"));
        
        specialization.setName(specializationData.getName());
        specialization.setDescription(specializationData.getDescription());
        specialization.setIsActive(specializationData.getIsActive());
        
        return specializationRepository.save(specialization);
    }

    @Transactional
    public void deleteSpecialization(UUID id) {
        specializationRepository.deleteById(id);
    }
}
