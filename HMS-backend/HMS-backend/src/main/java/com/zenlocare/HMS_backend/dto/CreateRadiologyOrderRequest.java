package com.zenlocare.HMS_backend.dto;

import lombok.*;
import java.time.LocalDate;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateRadiologyOrderRequest {
    private UUID hospitalId;
    private Integer patientId;
    private String serviceName;
    private String specializationName;
    private UUID technicianId;
    private String technicianName;
    private String priority;
    private LocalDate scheduledDate;
    private String billNo;
}
