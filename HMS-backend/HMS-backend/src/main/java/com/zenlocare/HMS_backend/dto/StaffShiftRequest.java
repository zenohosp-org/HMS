package com.zenlocare.HMS_backend.dto;

import lombok.*;
import java.time.LocalDate;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StaffShiftRequest {
    private UUID staffId;
    private UUID hospitalId;
    private String shiftType;
    private LocalDate shiftDate;
}
