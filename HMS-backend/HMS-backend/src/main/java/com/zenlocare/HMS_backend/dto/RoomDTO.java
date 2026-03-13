package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.RoomStatus;
import com.zenlocare.HMS_backend.entity.RoomType;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class RoomDTO {
    private Long id;
    private String roomNumber;
    private RoomType roomType;
    private RoomStatus status;
    private PatientSummaryDTO currentPatient;
    private LocalDateTime approxDischargeTime;
}

@Data
class PatientSummaryDTO {
    private Integer id;
    private String mrn;
    private String firstName;
    private String lastName;
}
