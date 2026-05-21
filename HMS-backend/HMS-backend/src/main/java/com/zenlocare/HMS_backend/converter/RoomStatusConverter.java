package com.zenlocare.HMS_backend.converter;

import com.zenlocare.HMS_backend.entity.RoomStatus;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class RoomStatusConverter implements AttributeConverter<RoomStatus, Integer> {

    @Override
    public Integer convertToDatabaseColumn(RoomStatus status) {
        return status == null ? null : status.id;
    }

    @Override
    public RoomStatus convertToEntityAttribute(Integer id) {
        return id == null ? null : RoomStatus.fromId(id);
    }
}
