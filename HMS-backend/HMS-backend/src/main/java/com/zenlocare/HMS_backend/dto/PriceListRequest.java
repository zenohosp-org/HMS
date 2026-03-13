package com.zenlocare.HMS_backend.dto;

import lombok.Data;
import java.util.UUID;

@Data
public class PriceListRequest {
    private String name;
    private String description;
    private Boolean isDefault;
    private Boolean isActive;
    private UUID hospitalId;
}
