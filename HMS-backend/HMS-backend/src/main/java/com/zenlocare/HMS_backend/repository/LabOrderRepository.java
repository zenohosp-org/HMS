package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.LabOrder;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LabOrderRepository extends JpaRepository<LabOrder, UUID> {

    @EntityGraph(attributePaths = {"orderedBy", "sampleCollectedBy", "resultedBy"})
    List<LabOrder> findByAdmissionIdAndHospitalIdOrderByCreatedAtDesc(
            UUID admissionId, UUID hospitalId);

    Optional<LabOrder> findByIdAndHospitalId(UUID id, UUID hospitalId);
}
