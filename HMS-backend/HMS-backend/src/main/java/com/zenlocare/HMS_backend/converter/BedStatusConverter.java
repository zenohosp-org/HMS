package com.zenlocare.HMS_backend.converter;

import com.zenlocare.HMS_backend.entity.BedStatus;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class BedStatusConverter implements AttributeConverter<BedStatus, Integer> {

    @Override
    public Integer convertToDatabaseColumn(BedStatus status) {
        return status == null ? null : status.id;
    }

    @Override
    public BedStatus convertToEntityAttribute(Integer id) {
        return id == null ? null : BedStatus.fromId(id);
    }
}
