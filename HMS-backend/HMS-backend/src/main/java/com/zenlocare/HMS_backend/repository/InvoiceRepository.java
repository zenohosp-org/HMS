package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    @Query("SELECT i FROM Invoice i LEFT JOIN FETCH i.patient WHERE i.hospital.id = :hospitalId ORDER BY i.createdAt DESC")
    List<Invoice> findByHospitalIdWithPatient(@Param("hospitalId") UUID hospitalId);

    @Query("SELECT i FROM Invoice i LEFT JOIN FETCH i.patient WHERE i.patient.id = :patientId ORDER BY i.createdAt DESC")
    List<Invoice> findByPatientIdWithPatient(@Param("patientId") Integer patientId);

    List<Invoice> findByHospitalId(UUID hospitalId);

    @Query("SELECT COALESCE(SUM(i.total), 0.0) FROM Invoice i WHERE i.hospital.id = :hid AND i.status IN (com.zenlocare.HMS_backend.entity.InvoiceStatus.PAID, com.zenlocare.HMS_backend.entity.InvoiceStatus.SETTLED)")
    double sumPaidByHospital(@Param("hid") UUID hospitalId);

    @Query("SELECT COALESCE(SUM(i.total), 0.0) FROM Invoice i WHERE i.hospital.id = :hid AND i.status NOT IN (com.zenlocare.HMS_backend.entity.InvoiceStatus.PAID, com.zenlocare.HMS_backend.entity.InvoiceStatus.SETTLED, com.zenlocare.HMS_backend.entity.InvoiceStatus.CANCELLED)")
    double sumOutstandingByHospital(@Param("hid") UUID hospitalId);

    @Query(value = "SELECT TO_CHAR(created_at, 'YYYY-MM') as month_str, " +
            "       SUM(CASE WHEN status_id IN (3, 5) THEN total ELSE 0 END) as paid, " +
            "       SUM(CASE WHEN status_id NOT IN (3, 5, 4) THEN total ELSE 0 END) as unpaid " +
            "FROM invoices " +
            "WHERE hospital_id = :hid " +
            "  AND created_at >= :startDate " +
            "GROUP BY TO_CHAR(created_at, 'YYYY-MM') " +
            "ORDER BY month_str ASC", nativeQuery = true)
    List<Object[]> getMonthlyRevenueSummary(@Param("hid") UUID hospitalId, @Param("startDate") java.time.LocalDateTime startDate);

    List<Invoice> findByPatientId(Integer patientId);
    List<Invoice> findByPatientIdOrderByCreatedAtDesc(Integer patientId);
    Invoice findByInvoiceNumber(String invoiceNumber);
    List<Invoice> findAllByAdmission_IdOrderByCreatedAtDesc(UUID admissionId);
    Optional<Invoice> findByAppointment_Id(UUID appointmentId);
    boolean existsByAppointment_Id(UUID appointmentId);

    // Open OPD bills for a patient — used by the admit modal's "merge into IPD" picker.
    // Returns invoices that are linked to an appointment, not yet linked to any admission,
    // and still collectible (not PAID / SETTLED / CANCELLED). Most recent first.
    //
    // JOIN FETCH appointment → doctor → user so the DTO mapper can populate
    // appointmentDoctorName without triggering N+1 lazy loads per row.
    @Query("""
        SELECT i FROM Invoice i
        LEFT JOIN FETCH i.appointment a
        LEFT JOIN FETCH a.doctor d
        LEFT JOIN FETCH d.user
        WHERE i.patient.id = :patientId
          AND i.hospital.id = :hospitalId
          AND i.appointment IS NOT NULL
          AND i.admission IS NULL
          AND i.status NOT IN (
              com.zenlocare.HMS_backend.entity.InvoiceStatus.PAID,
              com.zenlocare.HMS_backend.entity.InvoiceStatus.SETTLED,
              com.zenlocare.HMS_backend.entity.InvoiceStatus.CANCELLED)
        ORDER BY i.createdAt DESC
    """)
    List<Invoice> findOpenOpdInvoicesForPatient(
            @Param("hospitalId") UUID hospitalId,
            @Param("patientId") Integer patientId);

    @Query("""
        SELECT CASE WHEN COUNT(ii) > 0 THEN TRUE ELSE FALSE END
        FROM Invoice inv JOIN inv.items ii
        WHERE inv.patient.id = :patientId AND ii.itemType = 'REGISTRATION'
        """)
    boolean existsRegistrationFeeForPatient(@Param("patientId") Integer patientId);

    // Quick check used by the radiology auto-bill path — replaces a full-table
    // scan in InvoiceService.billRadiologyOrder. Returns true if any invoice
    // item anywhere already references this radiology order id.
    @Query("""
        SELECT CASE WHEN COUNT(ii) > 0 THEN TRUE ELSE FALSE END
        FROM InvoiceItem ii
        WHERE ii.radiologyOrderId = :radiologyOrderId
        """)
    boolean existsItemByRadiologyOrderId(@Param("radiologyOrderId") Long radiologyOrderId);

    /**
     * Returns all IPD invoices (linked to an admission) that are unpaid/unsettled
     * and have a zero or null total — candidates for estimate sync.
     */
    @Query("""
        SELECT i FROM Invoice i
        WHERE i.admission IS NOT NULL
        AND i.status IN (com.zenlocare.HMS_backend.entity.InvoiceStatus.UNPAID, com.zenlocare.HMS_backend.entity.InvoiceStatus.UNSETTLED, com.zenlocare.HMS_backend.entity.InvoiceStatus.PARTIAL)
        AND (i.total IS NULL OR i.total = 0)
        """)
    List<Invoice> findZeroPendingIpdInvoices();

    @Query("""
        SELECT i FROM Invoice i
        WHERE i.hospital.id = :hospitalId
        AND i.admission IS NULL
        AND (:status = 'ALL'
             OR CAST(i.status AS string) = :status)
        AND (
            LOWER(i.invoiceNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(i.patient.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(i.patient.lastName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(CONCAT(i.patient.firstName, ' ', i.patient.lastName))
                LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(i.patient.uhid) LIKE LOWER(CONCAT('%', :search, '%'))
        )
        ORDER BY i.createdAt DESC
        """)
    Page<Invoice> searchOpdInvoices(
        @Param("hospitalId") UUID hospitalId,
        @Param("status") String status,
        @Param("search") String search,
        Pageable pageable
    );

    @Query("""
        SELECT i FROM Invoice i
        WHERE i.hospital.id = :hospitalId
        AND i.admission IS NOT NULL
        AND (:status = 'ALL'
             OR CAST(i.status AS string) = :status)
        AND (
            LOWER(i.invoiceNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(i.patient.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(i.patient.lastName) LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(CONCAT(i.patient.firstName, ' ', i.patient.lastName))
                LIKE LOWER(CONCAT('%', :search, '%')) OR
            LOWER(i.patient.uhid) LIKE LOWER(CONCAT('%', :search, '%'))
        )
        ORDER BY i.createdAt DESC
        """)
    Page<Invoice> searchIpdInvoices(
        @Param("hospitalId") UUID hospitalId,
        @Param("status") String status,
        @Param("search") String search,
        Pageable pageable
    );
}
