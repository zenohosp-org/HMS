package com.zenlocare.HMS_backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayrollRecordDTO {
    private UUID id;
    private UUID staffId;
    private String staffName;
    private String role;
    private String department;
    private int month;
    private int year;
    private BigDecimal baseSalary;
    private BigDecimal bonus;
    private BigDecimal deductions;
    private BigDecimal netPay;
    private UUID bankAccountId;
    private String bankAccountName;
    private String paymentMethod;
    private LocalDateTime processedAt;
}
