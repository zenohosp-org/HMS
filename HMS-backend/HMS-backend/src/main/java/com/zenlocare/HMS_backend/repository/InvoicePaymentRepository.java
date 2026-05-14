package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.InvoicePayment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoicePaymentRepository extends JpaRepository<InvoicePayment, UUID> {
    List<InvoicePayment> findByInvoice_IdOrderByPaidAtAsc(UUID invoiceId);
}
