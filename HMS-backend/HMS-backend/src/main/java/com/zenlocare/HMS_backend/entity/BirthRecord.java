package com.zenlocare.HMS_backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "birth_records")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BirthRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mother_patient_id", nullable = false)
    private Patient mother;

    // Set after baby patient is auto-registered
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "baby_patient_id")
    private Patient baby;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @Column(name = "father_name", length = 100)
    private String fatherName;

    @Column(name = "father_phone", length = 20)
    private String fatherPhone;

    @Column(name = "delivery_type", length = 20)
    private String deliveryType; // NORMAL | LSCS | FORCEPS | VACUUM

    @Column(name = "birth_datetime")
    private LocalDateTime birthDatetime;

    @Column(name = "baby_gender", length = 10)
    private String babyGender; // MALE | FEMALE | UNKNOWN

    @Column(name = "baby_weight_kg", precision = 5, scale = 3)
    private BigDecimal babyWeightKg;

    @Column(name = "apgar_1_min")
    private Integer apgar1Min;

    @Column(name = "apgar_5_min")
    private Integer apgar5Min;

    @Column(name = "obstetrician", length = 100)
    private String obstetrician;

    @Column(name = "pediatrician", length = 100)
    private String pediatrician;

    @Column(name = "complications", columnDefinition = "TEXT")
    private String complications;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
