package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.RoomType;
import lombok.Data;
import java.util.UUID;

@Data
public class RoomCreateRequest {
    private UUID hospitalId;
    private String roomPrefix; // e.g. "GEN", "ICU"
    private RoomType roomType;
    private Integer count; // How many to generate
}
