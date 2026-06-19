package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.PrescriptionReturnRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PrescriptionReturnRequestRepository extends JpaRepository<PrescriptionReturnRequest, UUID> {

    /**
     * Idempotency lookup — used by the initiate endpoint so a retried POST
     * with the same {@code clientRequestId} returns the original row.
     */
    Optional<PrescriptionReturnRequest> findByClientRequestId(UUID clientRequestId);

    /**
     * Pharmacy poll target — mirrors {@code PrescriptionItemRepository.findPendingIpd}.
     * Fetches everything the pharmacy queue UI needs (item + drug, parent record,
     * patient, initiator) so the response can be built without N+1 queries.
     * Oldest-first so urgent requests surface at the top of the pharmacist's queue.
     */
    @Query("""
            SELECT prr FROM PrescriptionReturnRequest prr
            JOIN FETCH prr.prescriptionItem pi
            JOIN FETCH pi.record r
            JOIN FETCH r.patient p
            JOIN FETCH prr.initiatedByUser ib
            WHERE prr.hospital.id = :hospitalId
              AND prr.status = 'REQUESTED'
            ORDER BY prr.createdAt ASC
            """)
    List<PrescriptionReturnRequest> findPendingForHospital(@Param("hospitalId") UUID hospitalId);

    /**
     * Sum of confirmed returns for a prescription item — used by the initiate
     * guard so {@code returnQty} cannot exceed
     * {@code dispensedQty − administeredQty − alreadyPendingOrVerifiedReturnQty}.
     * Counts both REQUESTED (optimistic hold) and VERIFIED (finalised) rows.
     */
    @Query("""
            SELECT COALESCE(SUM(prr.returnQty), 0)
            FROM PrescriptionReturnRequest prr
            WHERE prr.prescriptionItem.id = :prescriptionItemId
              AND prr.status IN ('REQUESTED', 'VERIFIED')
            """)
    Integer sumHeldOrVerifiedQty(@Param("prescriptionItemId") UUID prescriptionItemId);
}
