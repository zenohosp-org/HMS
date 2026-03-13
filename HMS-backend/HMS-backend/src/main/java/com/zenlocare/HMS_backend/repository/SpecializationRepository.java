package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Specialization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SpecializationRepository extends JpaRepository<Specialization, UUID> {
    List<Specialization> findByHospitalId(UUID hospitalId);
}
