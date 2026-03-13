package com.zenlocare.HMS_backend.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class RoomAllocationRequest {
    private Long roomId;
    private Integer patientId;
    // Optional
    private LocalDateTime approxDischargeTime;
}
