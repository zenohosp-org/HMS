package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.Hospital;
import com.zenlocare.HMS_backend.entity.RoomTypeConfig;
import com.zenlocare.HMS_backend.repository.HospitalRepository;
import com.zenlocare.HMS_backend.repository.RoomTypeConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoomTypeConfigService {

    private final RoomTypeConfigRepository repo;
    private final HospitalRepository hospitalRepo;

    /** Returns all active types: system-wide + hospital-specific */
    public List<RoomTypeConfig> getAll(UUID hospitalId) {
        return repo.findActiveByHospitalId(hospitalId);
    }

    /** Create a new custom room type for a specific hospital */
    @Transactional
    public RoomTypeConfig create(UUID hospitalId, String code, String label, String category,
                                  String icon, String color) {
        if (repo.existsByHospitalIdAndCode(hospitalId, code)) {
            throw new RuntimeException("Room type code '" + code + "' already exists");
        }
        Hospital hospital = hospitalRepo.getReferenceById(hospitalId);
        return repo.save(RoomTypeConfig.builder()
                .hospital(hospital)
                .code(code.toUpperCase().replaceAll("[^A-Z0-9_]", "_"))
                .label(label)
                .category(category != null ? category : "WARD")
                .icon(icon)
                .color(color)
                .isSystem(false)
                .isActive(true)
                .build());
    }

    /** Update an existing custom room type (system types can only update label/color) */
    @Transactional
    public RoomTypeConfig update(UUID id, String label, String category, String icon, String color) {
        RoomTypeConfig config = repo.findById(id)
                .orElseThrow(() -> new RuntimeException("Room type config not found"));
        config.setLabel(label);
        if (!Boolean.TRUE.equals(config.getIsSystem())) {
            // Only non-system types can change category
            if (category != null) config.setCategory(category);
        }
        if (icon != null) config.setIcon(icon);
        if (color != null) config.setColor(color);
        return repo.save(config);
    }

    /** Soft-delete a custom room type. System types cannot be deleted. */
    @Transactional
    public void delete(UUID id) {
        RoomTypeConfig config = repo.findById(id)
                .orElseThrow(() -> new RuntimeException("Room type config not found"));
        if (Boolean.TRUE.equals(config.getIsSystem())) {
            throw new RuntimeException("System room types cannot be deleted");
        }
        config.setIsActive(false);
        repo.save(config);
    }
}
