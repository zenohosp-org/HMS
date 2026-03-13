package com.zenlocare.HMS_backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "patient_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PatientRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "history_id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy; // User (doctor or staff) who created this record

    // CONSULTATION | PRESCRIPTION | LAB_RESULT | SURGERY | DIAGNOSIS | OTHERS
    @Column(name = "history_type", nullable = false, length = 50)
    private String historyType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "next_visit_date")
    private LocalDateTime nextVisitDate;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
