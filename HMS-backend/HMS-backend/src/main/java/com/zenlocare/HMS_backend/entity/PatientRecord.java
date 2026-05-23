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
    // Persisted as integer FK into record_history_types (see HistoryTypeConverter).
    // The legacy `history_type` (String) column remains in the DB as a ghost
    // for any old code paths until cleanup; new writes only touch history_type_id.
    @Convert(converter = com.zenlocare.HMS_backend.converter.HistoryTypeConverter.class)
    @Column(name = "history_type_id")
    private HistoryType historyType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "next_visit_date")
    private LocalDateTime nextVisitDate;

    @Column(name = "admission_id")
    private UUID admissionId;

    @Column(name = "admission_number", length = 50)
    private String admissionNumber;

    @Column(name = "mrn", length = 30, unique = true)
    private String mrn;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
