package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.Admission;
import com.zenlocare.HMS_backend.entity.Bed;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class BedDto {
    private Long id;
    private String bedNumber;
    private String status;
    private Integer patientId;
    private String patientName;
    private String patientUhid;

    // From the bed's active admission (Admission.bed_id = this.id, status = ADMITTED).
    // Null on empty beds. The frontend needs admissionId to call PUT /api/admissions/{id}/attender.
    private UUID admissionId;
    private String attenderName;
    private String attenderPhone;
    private String attenderRelationship;

    public static BedDto fromEntity(Bed bed) {
        return fromEntity(bed, null);
    }

    public static BedDto fromEntity(Bed bed, Admission activeAdmission) {
        return BedDto.builder()
                .id(bed.getId())
                .bedNumber(bed.getBedNumber())
                .status(bed.getStatus().name())
                .patientId(bed.getCurrentPatient() != null ? bed.getCurrentPatient().getId() : null)
                .patientName(bed.getCurrentPatient() != null
                        ? bed.getCurrentPatient().getFirstName() + " " + bed.getCurrentPatient().getLastName()
                        : null)
                .patientUhid(bed.getCurrentPatient() != null ? bed.getCurrentPatient().getUhid() : null)
                .admissionId(activeAdmission != null ? activeAdmission.getId() : null)
                .attenderName(activeAdmission != null ? activeAdmission.getAttenderName() : null)
                .attenderPhone(activeAdmission != null ? activeAdmission.getAttenderPhone() : null)
                .attenderRelationship(activeAdmission != null ? activeAdmission.getAttenderRelationship() : null)
                .build();
    }
}
