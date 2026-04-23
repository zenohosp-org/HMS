package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.AdmissionSource;
import com.zenlocare.HMS_backend.entity.AdmissionType;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class AdmissionRequest {
    private UUID hospitalId;
    private Integer patientId;
    private Long roomId;
    private UUID admittingDoctorId;
    private UUID departmentId;
    private UUID sourceAppointmentId;
    private AdmissionType admissionType;
    private AdmissionSource admissionSource;
    private String chiefComplaint;
    private LocalDateTime approxDischargeDate;
    private String attenderName;
    private String attenderPhone;
    private String attenderRelationship;
}
