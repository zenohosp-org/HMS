package com.zenlocare.HMS_backend.converter;

import com.zenlocare.HMS_backend.entity.AdmissionType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class AdmissionTypeConverter implements AttributeConverter<AdmissionType, Integer> {

    @Override
    public Integer convertToDatabaseColumn(AdmissionType type) {
        return type == null ? null : type.id;
    }

    @Override
    public AdmissionType convertToEntityAttribute(Integer id) {
        return id == null ? null : AdmissionType.fromId(id);
    }
}
