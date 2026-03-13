package com.zenlocare.HMS_backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "hospitals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Hospital {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String subdomain; // "srm" → srm.zenohosp.com

    @Column(nullable = false, unique = true)
    private String code; // "SRM"

    private String email;
    private String phone;
    private String address;
    private String city;
    private String state;
    private String logoUrl;
    private String description;

    @Builder.Default
    private Boolean isActive = true;

    @Builder.Default
    private Boolean isListed = true; // Show on directory page?

    private String subscriptionPlan;

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
