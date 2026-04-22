package com.zenlocare.HMS_backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcessSalaryRequest {
    private UUID hospitalId;
    private UUID staffId;
    private int month;
    private int year;
    private BigDecimal baseSalary;
    private BigDecimal bonus;
    private BigDecimal deductions;
    private UUID bankAccountId;
    private String paymentMethod;
    private String referenceNo;
}
