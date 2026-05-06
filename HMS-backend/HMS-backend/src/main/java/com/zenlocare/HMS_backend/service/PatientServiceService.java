package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.PatientService;
import com.zenlocare.HMS_backend.exception.ResourceNotFoundException;
import com.zenlocare.HMS_backend.repository.PatientServiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PatientServiceService {

    private final PatientServiceRepository repository;

    public List<PatientService> getServicesByHospital(UUID hospitalId) {
        return repository.findByHospitalId(hospitalId);
    }

    public PatientService getServiceById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient service not found"));
    }

    public PatientService createService(PatientService service) {
        return repository.save(service);
    }

    public PatientService updateService(UUID id, PatientService details) {
        PatientService service = getServiceById(id);
        
        service.setName(details.getName());
        service.setType(details.getType());
        service.setMealTime(details.getMealTime());
        service.setPricePerMeal(details.getPricePerMeal());
        service.setPricePerDay(details.getPricePerDay());
        service.setIsActive(details.getIsActive());
        
        return repository.save(service);
    }

    public void deleteService(UUID id) {
        repository.deleteById(id);
    }

    public void toggleStatus(UUID id) {
        PatientService service = getServiceById(id);
        service.setIsActive(!service.getIsActive());
        repository.save(service);
    }

    @Transactional
    public void saveOrUpdateServices(UUID hospitalId, List<PatientService> services) {
        // Set hospital ID for all services
        services.forEach(s -> s.setHospitalId(hospitalId));
        
        // Delete existing services for this hospital
        List<PatientService> existing = repository.findByHospitalId(hospitalId);
        repository.deleteAll(existing);
        
        // Save all new services
        repository.saveAll(services);
    }
}
