package com.zenlocare.HMS_backend.converter;

import com.zenlocare.HMS_backend.entity.Appointment.AppointmentType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class AppointmentTypeConverter implements AttributeConverter<AppointmentType, Integer> {

    @Override
    public Integer convertToDatabaseColumn(AppointmentType type) {
        return type == null ? null : type.id;
    }

    @Override
    public AppointmentType convertToEntityAttribute(Integer id) {
        return id == null ? null : AppointmentType.fromId(id);
    }
}
