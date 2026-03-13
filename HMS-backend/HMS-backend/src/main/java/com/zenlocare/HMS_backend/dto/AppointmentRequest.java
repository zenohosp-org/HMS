package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.Appointment;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Data
public class AppointmentRequest {
    private UUID hospitalId;
    private UUID branchId;
    private Integer patientId;
    private UUID doctorId;
    private LocalDate apptDate;
    private LocalTime apptTime;
    private Appointment.AppointmentType type;
    private String chiefComplaint;
    private UUID priceListId;

    // For status updates
    private Appointment.AppointmentStatus status;
    private String cancelledReason;
}
