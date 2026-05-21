package com.zenlocare.HMS_backend.converter;

import com.zenlocare.HMS_backend.entity.AmbulanceBookingStatus;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class AmbulanceBookingStatusConverter implements AttributeConverter<AmbulanceBookingStatus, Integer> {

    @Override
    public Integer convertToDatabaseColumn(AmbulanceBookingStatus status) {
        return status == null ? null : status.id;
    }

    @Override
    public AmbulanceBookingStatus convertToEntityAttribute(Integer id) {
        return id == null ? null : AmbulanceBookingStatus.fromId(id);
    }
}
