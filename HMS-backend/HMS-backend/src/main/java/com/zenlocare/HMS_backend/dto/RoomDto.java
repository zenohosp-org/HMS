package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.Admission;
import com.zenlocare.HMS_backend.entity.Room;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * API representation of a Room. Mirrors the field shape the frontend already
 * reads (room.attenderName, room.allocationToken, room.currentPatient.*), but
 * resolves attender data from the room's active admission rather than the
 * dropped Room.attender_* columns. `admissionId` is the active admission's
 * UUID (null when none) so the frontend can call PUT /api/admissions/{id}/attender.
 */
@Data
@Builder
public class RoomDto {
    private Long id;
    private String roomNumber;
    private String roomCode;
    private String roomType;
    private String roomCategory;
    private Boolean hasBeds;
    private Boolean hasDailyCharge;
    private boolean occupied;
    private boolean underMaintenance;
    private BigDecimal pricePerDay;

    private PatientLite currentPatient;

    // From the active admission (status = ADMITTED, room_id = this.id), null otherwise.
    private UUID admissionId;
    private String attenderName;
    private String attenderPhone;
    private String attenderRelationship;

    private String allocationToken;
    private LocalDateTime approxDischargeTime;
    private LocalDateTime admissionDate;
    private String wardName;
    private String floorName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    public static class PatientLite {
        private Integer id;
        private String firstName;
        private String lastName;
        private String uhid;
        private String phone;
    }

    public static RoomDto fromEntity(Room room, Admission activeAdmission, com.zenlocare.HMS_backend.entity.RoomTypeConfig config) {
        PatientLite p = null;
        if (activeAdmission != null && activeAdmission.getPatient() != null) {
            p = PatientLite.builder()
                    .id(activeAdmission.getPatient().getId())
                    .firstName(activeAdmission.getPatient().getFirstName())
                    .lastName(activeAdmission.getPatient().getLastName())
                    .uhid(activeAdmission.getPatient().getUhid())
                    .phone(activeAdmission.getPatient().getPhone())
                    .build();
        }
        return RoomDto.builder()
                .id(room.getId())
                .roomNumber(room.getRoomNumber())
                .roomCode(room.getRoomCode())
                .roomType(room.getRoomType())
                .roomCategory(config != null ? config.getCategory() : "WARD")
                .hasBeds(config != null ? config.getHasBeds() : true)
                .hasDailyCharge(config != null ? config.getHasDailyCharge() : true)
                .occupied(activeAdmission != null)
                .underMaintenance(room.isUnderMaintenance())
                .pricePerDay(room.getPricePerDay())
                .currentPatient(p)
                .admissionId(activeAdmission != null ? activeAdmission.getId() : null)
                .attenderName(activeAdmission != null ? activeAdmission.getAttenderName() : null)
                .attenderPhone(activeAdmission != null ? activeAdmission.getAttenderPhone() : null)
                .attenderRelationship(activeAdmission != null ? activeAdmission.getAttenderRelationship() : null)
                .allocationToken(null)
                .approxDischargeTime(activeAdmission != null ? activeAdmission.getApproxDischargeDate() : null)
                .admissionDate(activeAdmission != null ? activeAdmission.getAdmissionDate() : null)
                .wardName(room.getHospitalWard() != null ? room.getHospitalWard().getName() : null)
                .floorName(room.getHospitalWard() != null && room.getHospitalWard().getFloor() != null
                        ? room.getHospitalWard().getFloor().getName()
                        : null)
                .createdAt(room.getCreatedAt())
                .updatedAt(room.getUpdatedAt())
                .build();
    }
}
