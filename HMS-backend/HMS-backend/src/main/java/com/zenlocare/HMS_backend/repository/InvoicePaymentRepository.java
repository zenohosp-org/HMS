package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.InvoicePayment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoicePaymentRepository extends JpaRepository<InvoicePayment, UUID> {
    List<InvoicePayment> findByInvoice_IdOrderByPaidAtAsc(UUID invoiceId);

    // Batched variant for page-building — one query for the whole page instead of
    // one per invoice. Caller groups the flat list by invoice id.
    List<InvoicePayment> findByInvoice_IdInOrderByPaidAtAsc(java.util.Collection<UUID> invoiceIds);
}
