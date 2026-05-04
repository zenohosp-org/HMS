package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.AdmissionSource;
import com.zenlocare.HMS_backend.entity.AdmissionStatus;
import com.zenlocare.HMS_backend.entity.AdmissionType;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdmissionDTO {
    private UUID id;
    private String admissionNumber;
    private String ipdId;
    private Integer patientId;
    private String patientName;
    private String patientMrn;
    private Long roomId;
    private String roomNumber;
    private String roomType;
    private java.math.BigDecimal roomPricePerDay;
    private Long bedId;
    private String bedNumber;
    private UUID admittingDoctorId;
    private String admittingDoctorName;
    private UUID departmentId;
    private String departmentName;
    private UUID sourceAppointmentId;
    private AdmissionType admissionType;
    private AdmissionSource admissionSource;
    private String chiefComplaint;
    private String primaryDiagnosis;
    private String dischargeDiagnosis;
    private String dischargeNote;
    private String attenderName;
    private String attenderPhone;
    private String attenderRelationship;
    private AdmissionStatus status;
    private LocalDateTime admissionDate;
    private LocalDateTime actualDischargeDate;
    private LocalDateTime approxDischargeDate;
    private LocalDateTime createdAt;
}
