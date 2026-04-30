package com.zenlocare.HMS_backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "hospital_wards")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HospitalWard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id", nullable = false)
    @JsonIgnore
    private HospitalFloor floor;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "daily_charge", precision = 10, scale = 2)
    private BigDecimal dailyCharge;

    @Column(name = "room_count")
    private Integer roomCount;

    @Column(name = "display_order")
    private Integer displayOrder;
}
