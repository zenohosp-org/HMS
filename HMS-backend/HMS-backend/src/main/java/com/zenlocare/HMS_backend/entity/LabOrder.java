package com.zenlocare.HMS_backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One lab test order placed during an IPD admission.
 *
 * Lifecycle:
 *   PENDING → SAMPLE_COLLECTED → RESULTED
 *
 * priority: ROUTINE | URGENT | STAT
 *
 * The result fields (value, unit, reference_range, notes) are filled in
 * at the RESULTED transition. They may be left null for qualitative tests
 * where result_notes carries the interpretation.
 */
@Entity
@Table(
    name = "lab_orders",
    indexes = @Index(name = "idx_lab_orders_admission",
                     columnList = "admission_id, created_at DESC")
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LabOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "admission_id", nullable = false)
    private UUID admissionId;

    @Column(name = "hospital_id", nullable = false)
    private UUID hospitalId;

    @Column(name = "test_name", nullable = false, length = 255)
    private String testName;

    @Column(name = "test_code", length = 100)
    private String testCode;

    /** PENDING | SAMPLE_COLLECTED | RESULTED */
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    /** ROUTINE | URGENT | STAT */
    @Column(name = "priority", nullable = false, length = 10)
    @Builder.Default
    private String priority = "ROUTINE";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ordered_by")
    private User orderedBy;

    @Column(name = "sample_collected_at")
    private LocalDateTime sampleCollectedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sample_collected_by")
    private User sampleCollectedBy;

    /** Free text or numeric result value */
    @Column(name = "result_value", columnDefinition = "TEXT")
    private String resultValue;

    /** Unit for numeric results, e.g. "mg/dL", "g/L" */
    @Column(name = "result_unit", length = 50)
    private String resultUnit;

    /** Normal reference range, e.g. "70–110 mg/dL" */
    @Column(name = "reference_range", length = 100)
    private String referenceRange;

    @Column(name = "result_notes", columnDefinition = "TEXT")
    private String resultNotes;

    @Column(name = "resulted_at")
    private LocalDateTime resultedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resulted_by")
    private User resultedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
