package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.InvoiceRequest;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final HospitalRepository hospitalRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final SpecializationRepository specializationRepository;
    private final BankAccountRepository bankAccountRepository;
    private final BankTransactionRepository bankTransactionRepository;

    @Transactional
    public Invoice createInvoice(InvoiceRequest request) {
        Hospital hospital = hospitalRepository.findById(request.getHospitalId())
                .orElseThrow(() -> new RuntimeException("Hospital not found"));
        Patient patient = patientRepository.findById(request.getPatientId())
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        Invoice invoice = Invoice.builder()
                .invoiceNumber(request.getInvoiceNumber())
                .hospital(hospital)
                .patient(patient)
                .subtotal(request.getSubtotal())
                .tax(request.getTax())
                .discount(request.getDiscount())
                .total(request.getTotal())
                .notes(request.getNotes())
                .paymentMethod(request.getPaymentMethod())
                .status(request.getStatus() != null ? request.getStatus() : InvoiceStatus.UNPAID)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        if (request.getAppointmentId() != null) {
            invoice.setAppointment(appointmentRepository.findById(request.getAppointmentId()).orElse(null));
        }
        if (request.getSpecializationId() != null) {
            invoice.setSpecialization(specializationRepository.findById(request.getSpecializationId()).orElse(null));
        }

        if (request.getItems() != null) {
            List<InvoiceItem> items = request.getItems().stream().map(itemRequest -> {
                return InvoiceItem.builder()
                        .invoice(invoice)
                        .serviceId(itemRequest.getServiceId())
                        .itemType(itemRequest.getItemType())
                        .description(itemRequest.getDescription())
                        .quantity(itemRequest.getQuantity())
                        .unitPrice(itemRequest.getUnitPrice())
                        .totalPrice(itemRequest.getTotalPrice())
                        .build();
            }).collect(Collectors.toList());
            invoice.setItems(items);
        }

        Invoice saved = invoiceRepository.save(invoice);

        // If paid immediately, credit the selected bank account
        if (InvoiceStatus.PAID.equals(saved.getStatus()) && request.getBankAccountId() != null) {
            creditBankAccount(request.getBankAccountId(), saved);
        }

        return saved;
    }

    @Transactional
    public Invoice markAsPaid(UUID invoiceId, UUID bankAccountId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found"));
        if (InvoiceStatus.PAID.equals(invoice.getStatus())) {
            throw new RuntimeException("Invoice is already paid");
        }
        invoice.setStatus(InvoiceStatus.PAID);
        invoice.setUpdatedAt(LocalDateTime.now());
        Invoice saved = invoiceRepository.save(invoice);
        if (bankAccountId != null) {
            creditBankAccount(bankAccountId, saved);
        }
        return saved;
    }

    private void creditBankAccount(UUID bankAccountId, Invoice invoice) {
        bankAccountRepository.findById(bankAccountId).ifPresent(account -> {
            bankTransactionRepository.save(BankTransaction.builder()
                    .hospitalId(account.getHospitalId())
                    .bankAccountId(bankAccountId)
                    .amount(invoice.getTotal())
                    .type("CREDIT")
                    .description("Invoice payment — " + invoice.getInvoiceNumber())
                    .referenceNo(invoice.getInvoiceNumber())
                    .relatedEntityId(invoice.getId())
                    .relatedEntityType("INVOICE")
                    .transactionDate(LocalDateTime.now())
                    .build());
        });
    }

    public List<Invoice> getHospitalInvoices(UUID hospitalId) {
        return invoiceRepository.findByHospitalId(hospitalId);
    }

    public List<Invoice> getPatientInvoices(Integer patientId) {
        return invoiceRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    public Invoice getInvoice(UUID id) {
        return invoiceRepository.findById(id).orElseThrow(() -> new RuntimeException("Invoice not found"));
    }
}
