package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.Bed;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BedDto {
    private Long id;
    private String bedNumber;
    private String status;
    private Integer patientId;
    private String patientName;
    private String patientMrn;

    public static BedDto fromEntity(Bed bed) {
        return BedDto.builder()
                .id(bed.getId())
                .bedNumber(bed.getBedNumber())
                .status(bed.getStatus().name())
                .patientId(bed.getCurrentPatient() != null ? bed.getCurrentPatient().getId() : null)
                .patientName(bed.getCurrentPatient() != null
                        ? bed.getCurrentPatient().getFirstName() + " " + bed.getCurrentPatient().getLastName()
                        : null)
                .patientMrn(bed.getCurrentPatient() != null ? bed.getCurrentPatient().getMrn() : null)
                .build();
    }
}
