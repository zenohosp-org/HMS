package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.InvoicePayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface InvoicePaymentRepository extends JpaRepository<InvoicePayment, UUID> {
    List<InvoicePayment> findByInvoice_IdOrderByPaidAtAsc(UUID invoiceId);

    // Batched variant for page-building — one query for the whole page instead of
    // one per invoice. Caller groups the flat list by invoice id.
    List<InvoicePayment> findByInvoice_IdInOrderByPaidAtAsc(java.util.Collection<UUID> invoiceIds);

    // Per-doctor, per-day collected-fees aggregation for finance reporting.
    //
    // A "collected fee" is one row in invoice_payments. The doctor is resolved via:
    //   - appointments.doctor_id      (OPD path: invoice ↔ appointment)
    //   - admissions.admitting_doctor (IPD path: invoice ↔ admission)
    // Payments whose invoice has neither (e.g. walk-in pharmacy bills) fall through
    // as doctor_id = NULL so the caller can surface an "unattributed" bucket.
    //
    // Date bucket = paid_at::date in the JVM/DB timezone. The service computes the
    // IST-aligned window in Java and passes [fromTs, toTs) so day boundaries match
    // the rest of the platform (Asia/Kolkata).
    //
    // Returns: Object[]{ doctorId UUID|null, payDate java.sql.Date, amount BigDecimal }.
    @Query(value = """
        SELECT
            COALESCE(ap.doctor_id, ad.admitting_doctor_id) AS doctor_id,
            CAST(ip.paid_at AS date)                       AS pay_date,
            COALESCE(SUM(ip.amount), 0)                    AS amount
        FROM invoice_payments ip
        JOIN invoices i        ON i.id  = ip.invoice_id
        LEFT JOIN appointments ap ON ap.id = i.appointment_id
        LEFT JOIN admissions   ad ON ad.id = i.admission_id
        WHERE i.hospital_id = :hospitalId
          AND ip.paid_at >= :fromTs
          AND ip.paid_at <  :toTs
        GROUP BY COALESCE(ap.doctor_id, ad.admitting_doctor_id), CAST(ip.paid_at AS date)
        """, nativeQuery = true)
    List<Object[]> sumPaymentsByDoctorPerDay(
            @Param("hospitalId") UUID hospitalId,
            @Param("fromTs") LocalDateTime fromTs,
            @Param("toTs") LocalDateTime toTs);
}
