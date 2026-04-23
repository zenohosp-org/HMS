package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.DesignationCategory;
import lombok.Data;
import java.util.UUID;

@Data
public class DesignationRequest {
    private UUID hospitalId;
    private UUID departmentId;
    private String name;
    private DesignationCategory category;
}
