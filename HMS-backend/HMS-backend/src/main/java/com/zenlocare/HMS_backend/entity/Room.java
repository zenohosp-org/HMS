package com.zenlocare.HMS_backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "rooms", uniqueConstraints = @UniqueConstraint(columnNames = { "hospital_id", "room_number" }))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    @JsonIgnore
    private Hospital hospital;

    @Column(name = "room_number", nullable = false, length = 20)
    private String roomNumber;

    @Column(name = "room_code", length = 20, unique = true)
    private String roomCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_type", nullable = false, length = 30)
    private RoomType roomType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private RoomStatus status;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "patient_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "hospital" })
    private Patient currentPatient;

    @Column(name = "price_per_day", precision = 10, scale = 2)
    private java.math.BigDecimal pricePerDay;

    @Column(name = "attender_name", length = 100)
    private String attenderName;

    @Column(name = "attender_phone", length = 20)
    private String attenderPhone;

    @Column(name = "attender_relationship", length = 50)
    private String attenderRelationship;

    @Column(name = "allocation_token", length = 30)
    private String allocationToken;

    @Column(name = "approx_discharge_time")
    private LocalDateTime approxDischargeTime;

    @Column(name = "admission_date")
    private LocalDateTime admissionDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Department department;

    @Column(name = "ward", length = 100)
    private String ward;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ward_id")
    @JsonIgnore
    private HospitalWard hospitalWard;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
