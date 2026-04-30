package com.zenlocare.HMS_backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "admissions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Admission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "room_id")
    private Room room;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "admitting_doctor_id")
    private Doctor admittingDoctor;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id")
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_appointment_id")
    private Appointment sourceAppointment;

    @Column(name = "admission_number", length = 30)
    private String admissionNumber;

    @Column(name = "ipd_id", length = 20, unique = true)
    private String ipdId;

    @Column(name = "admission_date", nullable = false)
    @Builder.Default
    private LocalDateTime admissionDate = LocalDateTime.now();

    @Column(name = "actual_discharge_date")
    private LocalDateTime actualDischargeDate;

    @Column(name = "approx_discharge_date")
    private LocalDateTime approxDischargeDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "admission_type", nullable = false, length = 30)
    @Builder.Default
    private AdmissionType admissionType = AdmissionType.ELECTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "admission_source", nullable = false, length = 30)
    @Builder.Default
    private AdmissionSource admissionSource = AdmissionSource.DIRECT;

    @Column(name = "chief_complaint", columnDefinition = "TEXT")
    private String chiefComplaint;

    @Column(name = "primary_diagnosis", columnDefinition = "TEXT")
    private String primaryDiagnosis;

    @Column(name = "discharge_diagnosis", columnDefinition = "TEXT")
    private String dischargeDiagnosis;

    @Column(name = "discharge_note", columnDefinition = "TEXT")
    private String dischargeNote;

    @Column(name = "attender_name", length = 100)
    private String attenderName;

    @Column(name = "attender_phone", length = 20)
    private String attenderPhone;

    @Column(name = "attender_relationship", length = 50)
    private String attenderRelationship;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private AdmissionStatus status = AdmissionStatus.ADMITTED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() { this.updatedAt = LocalDateTime.now(); }
}
