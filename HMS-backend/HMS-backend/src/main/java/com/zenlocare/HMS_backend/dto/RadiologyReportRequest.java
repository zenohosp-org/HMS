package com.zenlocare.HMS_backend.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RadiologyReportRequest {
    private String findings;
    private String observation;
}
