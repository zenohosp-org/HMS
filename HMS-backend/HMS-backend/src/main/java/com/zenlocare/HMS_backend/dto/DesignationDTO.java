package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.DesignationCategory;
import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data @Builder
public class DesignationDTO {
    private UUID id;
    private String name;
    private DesignationCategory category;
    private UUID departmentId;
    private String departmentName;
    private Boolean isActive;
}
