package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    List<Invoice> findByHospitalId(UUID hospitalId);
    List<Invoice> findByPatientId(Integer patientId);
    Invoice findByInvoiceNumber(String invoiceNumber);
}
