package com.zenlocare.HMS_backend.converter;

import com.zenlocare.HMS_backend.entity.Appointment.AppointmentStatus;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class AppointmentStatusConverter implements AttributeConverter<AppointmentStatus, Integer> {

    @Override
    public Integer convertToDatabaseColumn(AppointmentStatus status) {
        return status == null ? null : status.id;
    }

    @Override
    public AppointmentStatus convertToEntityAttribute(Integer id) {
        return id == null ? null : AppointmentStatus.fromId(id);
    }
}
