package com.zenlocare.HMS_backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "assets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Asset {

    @Id
    @Column(name = "asset_id")
    private UUID assetId;

    @Column(name = "hospital_id")
    private UUID hospitalId;

    @Column(name = "asset_name", nullable = false)
    private String assetName;

    @Column(name = "asset_code")
    private String assetCode;

    @Column(name = "status")
    private String status;

    @Column(name = "make")
    private String make;

    @Column(name = "model")
    private String model;

    @Column(name = "serial_number")
    private String serialNumber;

    @Column(name = "location")
    private String location;

    @Column(name = "description")
    private String description;

    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    @Column(name = "purchase_price")
    private Double purchasePrice;

    @Column(name = "current_value")
    private Double currentValue;

    @Column(name = "warranty_expiry")
    private LocalDate warrantyExpiry;

    // ── Room assignment fields (writable from HMS) ─────────────────────────

    @Column(name = "room_id")
    private Long roomId;

    @Column(name = "assigned_to")
    private UUID assignedTo;

    @Column(name = "assigned_to_type", length = 255)
    private String assignedToType;

    @Column(name = "floor")
    private Short floor;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
