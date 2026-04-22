package com.zenlocare.HMS_backend.dto;

import lombok.*;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffShiftDTO {
    private Long id;
    private UUID staffId;
    private String staffName;
    private String role;
    private String designation;
    private String shiftType;
    private LocalDate shiftDate;
}
