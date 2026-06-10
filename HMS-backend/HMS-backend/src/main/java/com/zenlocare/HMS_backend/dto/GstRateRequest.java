package com.zenlocare.HMS_backend.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

@Data
public class GstRateRequest {
    private UUID hospitalId;
    private String name;
    private BigDecimal ratePercent;
    private BigDecimal cgstPercent;
    private BigDecimal sgstPercent;
    private BigDecimal igstPercent;
    private BigDecimal cessPercent;
    private Boolean isDefault;
}
