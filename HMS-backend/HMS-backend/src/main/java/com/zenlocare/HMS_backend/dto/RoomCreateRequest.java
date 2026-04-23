package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.RoomType;
import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

@Data
public class RoomCreateRequest {
    private UUID hospitalId;
    private String roomPrefix;
    private RoomType roomType;
    private Integer count;
    private BigDecimal pricePerDay;
    private UUID departmentId;
    private String ward;
}
