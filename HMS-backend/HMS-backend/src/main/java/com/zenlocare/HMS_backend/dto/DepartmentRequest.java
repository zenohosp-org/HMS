package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.DepartmentType;
import lombok.Data;
import java.util.UUID;

@Data
public class DepartmentRequest {
    private UUID hospitalId;
    private String name;
    private DepartmentType type;
    private String code;
    private String description;
}
