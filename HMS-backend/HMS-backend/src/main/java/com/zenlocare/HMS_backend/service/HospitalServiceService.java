package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.HospitalService;
import com.zenlocare.HMS_backend.repository.HospitalServiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HospitalServiceService {

    private final HospitalServiceRepository repository;

    public List<HospitalService> getServicesByHospital(UUID hospitalId) {
        return repository.findByHospitalId(hospitalId);
    }

    public HospitalService createService(HospitalService service) {
        return repository.save(service);
    }

    public HospitalService updateService(UUID id, HospitalService details) {
        HospitalService service = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Service not found"));
        
        service.setName(details.getName());
        service.setSpecializationId(details.getSpecializationId());
        service.setPrice(details.getPrice());
        service.setIsActive(details.getIsActive());
        
        return repository.save(service);
    }

    public void deleteService(UUID id) {
        repository.deleteById(id);
    }

    public void toggleStatus(UUID id) {
        HospitalService service = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Service not found"));
        service.setIsActive(!service.getIsActive());
        repository.save(service);
    }
}
