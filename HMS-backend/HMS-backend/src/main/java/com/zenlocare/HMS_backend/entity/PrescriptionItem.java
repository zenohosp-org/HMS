package com.zenlocare.HMS_backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One line of a prescription. Multiple PrescriptionItems belong to one
 * PatientRecord (historyType=PRESCRIPTION). Pharmacy reads these rows to
 * dispense; HMS does not track dispense state here — that belongs on pharmacy's
 * own dispense table.
 *
 * Drug metadata is denormalised from {@code pharmacy_drug_master} at write
 * time so a prescription survives drug-master renames, soft-deletes, or
 * cross-hospital cleanup. {@code drugId} is the live FK (nullable to allow
 * free-text prescription of a drug not yet in the master).
 */
@Entity
@Table(
    name = "prescription_items",
    indexes = {
        @Index(name = "idx_prescription_items_history_id", columnList = "history_id"),
        @Index(name = "idx_prescription_items_drug_id",    columnList = "drug_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrescriptionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Parent prescription record. Cascade is configured on the OneToMany side
     * (PatientRecord.prescriptionItems) so removing a parent removes all items.
     * JsonIgnore prevents infinite recursion when serialising.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "history_id", nullable = false)
    @JsonIgnore
    private PatientRecord record;

    /**
     * Soft pointer to pharmacy_drug_master.id. Nullable because:
     *  (a) doctors may prescribe a drug not yet in the hospital's master, and
     *  (b) the master row could be deleted while the prescription stays.
     * The denormalised drug_name / generic / strength / form fields below carry
     * the dispensable description regardless.
     */
    @Column(name = "drug_id")
    private UUID drugId;

    @Column(name = "drug_name", nullable = false, length = 255)
    private String drugName;

    @Column(name = "drug_generic", length = 255)
    private String drugGeneric;

    @Column(name = "drug_strength", length = 100)
    private String drugStrength;

    /** Form factor — TAB, CAP, SYRUP, INJ, DROPS, OINT, INH, etc. */
    @Column(name = "drug_form", length = 50)
    private String drugForm;

    /** Per-administration amount — "1 tablet", "10ml", "2 puffs". */
    @Column(length = 100)
    private String dose;

    /**
     * Schedule shorthand — OD, BD, TDS, QID, SOS, Q4H, HS, AC, PC, STAT.
     * Stored as an integer FK into {@code prescription_frequencies}; same
     * pattern AppointmentStatus / RoomStatus use.
     */
    @Convert(converter = com.zenlocare.HMS_backend.converter.PrescriptionFrequencyConverter.class)
    @Column(name = "frequency_id")
    private PrescriptionFrequency frequency;

    /** Treatment length in days. Null for SOS / chronic / variable. */
    @Column(name = "duration_days")
    private Integer durationDays;

    /** Total units to dispense — what pharmacy will count out. */
    @Column(nullable = false)
    private Integer quantity;

    /**
     * Route of administration — ORAL, IV, IM, SC, TOPICAL, INHALED, etc.
     * Integer FK into {@code prescription_routes}.
     */
    @Convert(converter = com.zenlocare.HMS_backend.converter.PrescriptionRouteConverter.class)
    @Column(name = "route_id")
    private PrescriptionRoute route;

    /** Free-text per-drug notes ("after meals", "with milk", "taper over 5 days"). */
    @Column(columnDefinition = "TEXT")
    private String instructions;

    /** Order in which the drugs appear on the printed prescription. */
    @Column(name = "display_order")
    @Builder.Default
    private Integer displayOrder = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
