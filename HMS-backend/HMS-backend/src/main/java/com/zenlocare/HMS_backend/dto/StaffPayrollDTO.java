package com.zenlocare.HMS_backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffPayrollDTO {
    private UUID staffId;
    private String staffName;
    private String role;
    private String department;
    private BigDecimal basicSalary;
    // Last paid record info
    private Integer lastPaidMonth;
    private Integer lastPaidYear;
    private BigDecimal lastNetPay;
    private LocalDateTime lastPaidAt;
}
