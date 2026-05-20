package com.zenlocare.HMS_backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "casualty_details")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CasualtyDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false, unique = true)
    private Patient patient;

    @Column(name = "triage_category", length = 10)
    private String triageCategory; // RED | YELLOW | GREEN

    @Column(name = "brought_by", length = 20)
    private String broughtBy; // SELF | FAMILY | POLICE | AMBULANCE | PASSERBY

    @Column(name = "mode_of_arrival", length = 20)
    private String modeOfArrival; // WALKING | STRETCHER | AMBULANCE

    @Column(name = "is_mlc")
    @Builder.Default
    private Boolean isMlc = false;

    @Column(name = "mlc_number", length = 30)
    private String mlcNumber;

    @Column(name = "police_station", length = 100)
    private String policeStation;

    @Column(name = "officer_name", length = 100)
    private String officerName;

    @Column(name = "conscious_state", length = 20)
    private String consciousState; // CONSCIOUS | SEMI_CONSCIOUS | UNCONSCIOUS

    @Column(name = "mechanism", length = 30)
    private String mechanism; // ROAD_ACCIDENT | FALL | ASSAULT | POISONING | BURNS | SNAKE_BITE | CARDIAC | OTHER

    @Column(name = "vitals_bp", length = 15)
    private String vitalsBp;

    @Column(name = "vitals_pulse", length = 10)
    private String vitalsPulse;

    @Column(name = "vitals_spo2", length = 10)
    private String vitalsSpO2;

    @Column(name = "vitals_gcs", length = 5)
    private String vitalsGcs;

    @Column(name = "referred_from", length = 100)
    private String referredFrom;

    @Column(name = "arrival_time")
    private LocalDateTime arrivalTime;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
