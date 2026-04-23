package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    @Query("SELECT i FROM Invoice i LEFT JOIN FETCH i.patient WHERE i.hospital.id = :hospitalId ORDER BY i.createdAt DESC")
    List<Invoice> findByHospitalIdWithPatient(@Param("hospitalId") UUID hospitalId);

    @Query("SELECT i FROM Invoice i LEFT JOIN FETCH i.patient WHERE i.patient.id = :patientId ORDER BY i.createdAt DESC")
    List<Invoice> findByPatientIdWithPatient(@Param("patientId") Integer patientId);

    List<Invoice> findByHospitalId(UUID hospitalId);
    List<Invoice> findByPatientId(Integer patientId);
    List<Invoice> findByPatientIdOrderByCreatedAtDesc(Integer patientId);
    Invoice findByInvoiceNumber(String invoiceNumber);
}
