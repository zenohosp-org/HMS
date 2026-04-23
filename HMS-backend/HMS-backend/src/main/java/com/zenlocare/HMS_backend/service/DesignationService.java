package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.DesignationDTO;
import com.zenlocare.HMS_backend.dto.DesignationRequest;
import com.zenlocare.HMS_backend.entity.Department;
import com.zenlocare.HMS_backend.entity.Designation;
import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.repository.DepartmentRepository;
import com.zenlocare.HMS_backend.repository.DesignationRepository;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DesignationService {

    private final DesignationRepository designationRepository;
    private final HospitalRepository hospitalRepository;
    private final DepartmentRepository departmentRepository;

    public List<DesignationDTO> getAll(UUID hospitalId) {
        return designationRepository.findByHospitalIdOrderByCategoryAscNameAsc(hospitalId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<DesignationDTO> getActive(UUID hospitalId) {
        return designationRepository.findByHospitalIdAndIsActiveTrue(hospitalId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<DesignationDTO> getByDepartment(UUID hospitalId, UUID departmentId) {
        return designationRepository.findByHospitalIdAndDepartmentIdOrderByNameAsc(hospitalId, departmentId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public DesignationDTO create(DesignationRequest req) {
        Hospital hospital = hospitalRepository.findById(req.getHospitalId())
                .orElseThrow(() -> new RuntimeException("Hospital not found"));
        Department dept = req.getDepartmentId() != null
                ? departmentRepository.findById(req.getDepartmentId()).orElse(null)
                : null;
        Designation d = Designation.builder()
                .hospital(hospital)
                .department(dept)
                .name(req.getName())
                .category(req.getCategory())
                .build();
        return toDTO(designationRepository.save(d));
    }

    public DesignationDTO toggle(UUID id) {
        Designation d = designationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Designation not found"));
        d.setIsActive(!d.getIsActive());
        return toDTO(designationRepository.save(d));
    }

    public DesignationDTO toDTO(Designation d) {
        return DesignationDTO.builder()
                .id(d.getId())
                .name(d.getName())
                .category(d.getCategory())
                .departmentId(d.getDepartment() != null ? d.getDepartment().getId() : null)
                .departmentName(d.getDepartment() != null ? d.getDepartment().getName() : null)
                .isActive(d.getIsActive())
                .build();
    }
}
