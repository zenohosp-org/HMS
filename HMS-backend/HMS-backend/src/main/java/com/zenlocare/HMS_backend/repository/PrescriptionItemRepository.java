package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.PrescriptionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PrescriptionItemRepository extends JpaRepository<PrescriptionItem, UUID> {

    /**
     * Hospital-wide pending IPD prescription items. Joins through the parent
     * PatientRecord to require an admissionId, and fetches patient + creator
     * eagerly so the pharmacy queue UI can render rows without a per-row
     * lookup. Excludes anything already fully dispensed.
     *
     * Ordered oldest-first so the most urgent (longest-waiting) request
     * surfaces at the top of the pharmacist's queue.
     */
    @Query("""
            SELECT pi FROM PrescriptionItem pi
            JOIN FETCH pi.record r
            JOIN FETCH r.patient p
            JOIN FETCH r.createdBy u
            WHERE r.hospital.id = :hospitalId
              AND r.admissionId IS NOT NULL
              AND pi.dispenseStatus <> com.zenlocare.HMS_backend.entity.PrescriptionDispenseStatus.DISPENSED
            ORDER BY r.createdAt ASC
            """)
    List<PrescriptionItem> findPendingIpd(@Param("hospitalId") UUID hospitalId);

    /**
     * All prescription items ordered during a single IPD admission, for the MAR
     * tab. Joins through the parent PatientRecord to filter by both admissionId
     * and hospitalId (tenant isolation). Includes all dispense statuses — the
     * MAR needs to track administration of every ordered drug, including those
     * already dispensed by pharmacy.
     *
     * Ordered by prescription date then display_order so drugs appear in the
     * same sequence as on the printed prescription.
     */
    @Query("""
            SELECT pi FROM PrescriptionItem pi
            JOIN FETCH pi.record r
            JOIN FETCH r.createdBy u
            LEFT JOIN FETCH pi.stoppedBy sb
            WHERE r.admissionId = :admissionId
              AND r.hospital.id = :hospitalId
            ORDER BY r.createdAt ASC, pi.displayOrder ASC
            """)
    List<PrescriptionItem> findByAdmissionIdAndHospitalId(
            @Param("admissionId") UUID admissionId,
            @Param("hospitalId") UUID hospitalId);
}
