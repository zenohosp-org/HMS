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
    private String status;
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

    private UUID departmentId;
    private String departmentName;
    private String ward;
    private Long hospitalWardId;
    private Integer bedCount;
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

    public static RoomDto fromEntity(Room room, Admission activeAdmission) {
        PatientLite p = null;
        if (room.getCurrentPatient() != null) {
            p = PatientLite.builder()
                    .id(room.getCurrentPatient().getId())
                    .firstName(room.getCurrentPatient().getFirstName())
                    .lastName(room.getCurrentPatient().getLastName())
                    .uhid(room.getCurrentPatient().getUhid())
                    .phone(room.getCurrentPatient().getPhone())
                    .build();
        }
        return RoomDto.builder()
                .id(room.getId())
                .roomNumber(room.getRoomNumber())
                .roomCode(room.getRoomCode())
                .roomType(room.getRoomType())
                .status(room.getStatus() != null ? room.getStatus().name() : null)
                .pricePerDay(room.getPricePerDay())
                .currentPatient(p)
                .admissionId(activeAdmission != null ? activeAdmission.getId() : null)
                .attenderName(activeAdmission != null ? activeAdmission.getAttenderName() : null)
                .attenderPhone(activeAdmission != null ? activeAdmission.getAttenderPhone() : null)
                .attenderRelationship(activeAdmission != null ? activeAdmission.getAttenderRelationship() : null)
                .allocationToken(room.getAllocationToken())
                .approxDischargeTime(room.getApproxDischargeTime())
                .admissionDate(room.getAdmissionDate())
                .departmentId(room.getDepartment() != null ? room.getDepartment().getId() : null)
                .departmentName(room.getDepartment() != null ? room.getDepartment().getName() : null)
                .ward(room.getWard())
                .hospitalWardId(room.getHospitalWard() != null ? room.getHospitalWard().getId() : null)
                .bedCount(room.getBedCount())
                .createdAt(room.getCreatedAt())
                .updatedAt(room.getUpdatedAt())
                .build();
    }
}
