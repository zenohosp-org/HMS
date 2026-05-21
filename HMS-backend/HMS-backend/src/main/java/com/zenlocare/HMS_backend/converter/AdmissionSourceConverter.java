package com.zenlocare.HMS_backend.converter;

import com.zenlocare.HMS_backend.entity.AdmissionSource;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class AdmissionSourceConverter implements AttributeConverter<AdmissionSource, Integer> {

    @Override
    public Integer convertToDatabaseColumn(AdmissionSource source) {
        return source == null ? null : source.id;
    }

    @Override
    public AdmissionSource convertToEntityAttribute(Integer id) {
        return id == null ? null : AdmissionSource.fromId(id);
    }
}
