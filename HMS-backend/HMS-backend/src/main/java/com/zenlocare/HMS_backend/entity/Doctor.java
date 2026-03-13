package com.zenlocare.HMS_backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "doctors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Doctor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    private String specialization;

    // e.g., MBBS, MD, DNB
    private String qualification;

    @Column(name = "medical_registration_number")
    private String medicalRegistrationNumber;

    // e.g., Tamil Nadu Medical Council
    @Column(name = "registration_council")
    private String registrationCouncil;

    @Column(name = "consultation_fee", precision = 10, scale = 2)
    private BigDecimal consultationFee;

    @Column(name = "follow_up_fee", precision = 10, scale = 2)
    private BigDecimal followUpFee;

    // e.g., "MON,TUE,WED,THU,FRI"
    @Column(name = "available_days")
    private String availableDays;

    @Column(name = "slot_duration_min")
    @Builder.Default
    private Integer slotDurationMin = 15;

    @Column(name = "max_daily_slots")
    private Integer maxDailySlots;

    @Builder.Default
    @Column(updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
