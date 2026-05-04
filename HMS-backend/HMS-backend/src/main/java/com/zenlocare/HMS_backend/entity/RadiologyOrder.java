package com.zenlocare.HMS_backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "radiology_orders")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RadiologyOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admission_id")
    private Admission admission;

    @Column(name = "service_name", nullable = false, length = 200)
    private String serviceName;

    @Column(name = "specialization_name", length = 200)
    private String specializationName;

    @Column(name = "referred_by_name", length = 200)
    private String referredByName;

    @Column(name = "technician_id")
    private UUID technicianId;

    @Column(name = "technician_name", length = 200)
    private String technicianName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private RadiologyPriority priority = RadiologyPriority.ROUTINE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 25)
    @Builder.Default
    private RadiologyStatus status = RadiologyStatus.PENDING_SCAN;

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @Column(name = "bill_no", length = 50)
    private String billNo;

    @Column(name = "scanned_at")
    private LocalDateTime scannedAt;

    @Column(name = "reported_at")
    private LocalDateTime reportedAt;

    @Column(columnDefinition = "TEXT")
    private String findings;

    @Column(columnDefinition = "TEXT")
    private String observation;

    @Column(name = "report_id", length = 20)
    private String reportId;

    @Column(name = "created_by_name", length = 200)
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
