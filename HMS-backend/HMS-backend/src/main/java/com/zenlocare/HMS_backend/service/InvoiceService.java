package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.InvoiceDTO;
import com.zenlocare.HMS_backend.dto.InvoiceRequest;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.entity.Appointment;
import com.zenlocare.HMS_backend.entity.InvoicePayment;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final HospitalRepository hospitalRepository;
    private final PatientRepository patientRepository;
    private final AdmissionRepository admissionRepository;
    private final RadiologyOrderRepository radiologyOrderRepository;
    private final AppointmentRepository appointmentRepository;
    private final SpecializationRepository specializationRepository;
    private final BankAccountRepository bankAccountRepository;
    private final BankTransactionRepository bankTransactionRepository;
    private final PatientAdvanceService patientAdvanceService;
    private final InvoicePaymentRepository invoicePaymentRepository;

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

        if (request.getAdmissionId() != null) {
            invoice.setAdmission(admissionRepository.findById(request.getAdmissionId()).orElse(null));
        }
        if (request.getAppointmentId() != null) {
            invoice.setAppointment(appointmentRepository.findById(request.getAppointmentId()).orElse(null));
        }
        if (request.getSpecializationId() != null) {
            invoice.setSpecialization(specializationRepository.findById(request.getSpecializationId()).orElse(null));
        }

        if (request.getItems() != null) {
            List<InvoiceItem> items = request.getItems().stream().map(itemRequest ->
                InvoiceItem.builder()
                        .invoice(invoice)
                        .serviceId(itemRequest.getServiceId())
                        .radiologyOrderId(itemRequest.getRadiologyOrderId())
                        .appointmentId(itemRequest.getAppointmentId())
                        .itemType(itemRequest.getItemType())
                        .description(itemRequest.getDescription())
                        .quantity(itemRequest.getQuantity())
                        .unitPrice(itemRequest.getUnitPrice())
                        .totalPrice(itemRequest.getTotalPrice())
                        .build()
            ).collect(Collectors.toList());
            invoice.setItems(items);
        }

        Invoice saved = invoiceRepository.save(invoice);

        // Mark linked radiology orders as BILLED — runs in same transaction,
        // so if invoice creation fails the orders are not incorrectly marked.
        if (saved.getItems() != null) {
            saved.getItems().stream()
                .filter(item -> "RADIOLOGY".equals(item.getItemType()) && item.getRadiologyOrderId() != null)
                .forEach(item -> radiologyOrderRepository.findById(item.getRadiologyOrderId())
                    .ifPresent(order -> {
                        order.setStatus(RadiologyStatus.BILLED);
                        radiologyOrderRepository.save(order);
                    }));
        }

        // Mark linked appointments as BILLED — same transaction, atomic with invoice save.
        if (saved.getItems() != null) {
            saved.getItems().stream()
                .filter(item -> "CONSULTATION".equals(item.getItemType()) && item.getAppointmentId() != null)
                .forEach(item -> appointmentRepository.findById(item.getAppointmentId())
                    .ifPresent(appt -> {
                        appt.setStatus(Appointment.AppointmentStatus.BILLED);
                        appointmentRepository.save(appt);
                    }));
        }

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

    @Transactional
    public InvoiceDTO collectPayment(UUID invoiceId, BigDecimal amount, String paymentMethod,
                                     UUID bankAccountId, String collectedBy) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found"));
        if (InvoiceStatus.PAID.equals(invoice.getStatus())) {
            throw new RuntimeException("Invoice is already fully paid");
        }

        invoicePaymentRepository.save(InvoicePayment.builder()
                .invoice(invoice)
                .amount(amount)
                .paymentMethod(paymentMethod)
                .bankAccountId(bankAccountId)
                .collectedBy(collectedBy)
                .build());

        BigDecimal newPaid = (invoice.getPaidAmount() != null ? invoice.getPaidAmount() : BigDecimal.ZERO)
                .add(amount);
        invoice.setPaidAmount(newPaid);
        invoice.setUpdatedAt(LocalDateTime.now());

        BigDecimal advance = invoice.getAdvanceAdjusted() != null ? invoice.getAdvanceAdjusted() : BigDecimal.ZERO;
        BigDecimal total = invoice.getTotal() != null ? invoice.getTotal() : BigDecimal.ZERO;
        boolean fullyPaid = newPaid.add(advance).compareTo(total) >= 0;

        invoice.setStatus(fullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL);

        if (fullyPaid && invoice.getAdmission() != null && advance.compareTo(BigDecimal.ZERO) > 0) {
            try {
                patientAdvanceService.markAdvancesApplied(
                        invoice.getAdmission().getId(), invoice.getId(), advance);
            } catch (Exception ignored) {}
        }

        if (bankAccountId != null) {
            bankAccountRepository.findById(bankAccountId).ifPresent(account -> {
                bankTransactionRepository.save(BankTransaction.builder()
                        .hospitalId(account.getHospitalId())
                        .bankAccountId(bankAccountId)
                        .amount(amount)
                        .type("CREDIT")
                        .description("Payment — " + invoice.getInvoiceNumber())
                        .referenceNo(invoice.getInvoiceNumber())
                        .relatedEntityId(invoice.getId())
                        .relatedEntityType("INVOICE")
                        .transactionDate(LocalDateTime.now())
                        .build());
            });
        }

        return toDTO(invoiceRepository.save(invoice));
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

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<InvoiceDTO> getHospitalInvoices(UUID hospitalId) {
        return invoiceRepository.findByHospitalIdWithPatient(hospitalId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<InvoiceDTO> getPatientInvoices(Integer patientId) {
        return invoiceRepository.findByPatientIdWithPatient(patientId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public Invoice getInvoice(UUID id) {
        return invoiceRepository.findById(id).orElseThrow(() -> new RuntimeException("Invoice not found"));
    }

    // ── Auto-create a zero-total placeholder invoice when a patient is admitted ──
    // OPD→IPD edge case: if the admission originated from an OPD appointment that
    // already has an unpaid invoice, absorb it — link it to this admission so the
    // consultation fee carries over into the IPD bill. No separate OPD invoice remains.
    // sourceAppointmentId is passed directly from the caller to avoid lazy-loading the
    // Admission.sourceAppointment proxy inside this transaction.
    @Transactional
    public void createAdmissionInvoice(UUID hospitalId, Integer patientId, UUID admissionId,
                                       String admissionNumber, UUID sourceAppointmentId) {
        if (invoiceRepository.findByAdmission_Id(admissionId).isPresent()) return;
        Hospital hospital = hospitalRepository.findById(hospitalId).orElse(null);
        Patient patient = patientRepository.findById(patientId).orElse(null);
        Admission admission = admissionRepository.findById(admissionId).orElse(null);
        if (hospital == null || patient == null || admission == null) return;

        // Absorb the OPD invoice when this admission was triggered from an OPD appointment
        if (sourceAppointmentId != null) {
            Optional<Invoice> opdOpt = invoiceRepository.findByAppointment_Id(sourceAppointmentId);
            if (opdOpt.isPresent()) {
                Invoice opdInvoice = opdOpt.get();
                if (!InvoiceStatus.PAID.equals(opdInvoice.getStatus())) {
                    // Promote: link OPD invoice to this admission — it becomes the IPD invoice
                    opdInvoice.setAdmission(admission);
                    opdInvoice.setInvoiceNumber("IPD-" + admissionNumber);
                    opdInvoice.setNotes("IPD Admission (converted from OPD) — " + admissionNumber);
                    opdInvoice.setUpdatedAt(LocalDateTime.now());
                    invoiceRepository.save(opdInvoice);
                    return;
                }
                // OPD invoice already paid (rare) — fall through and create a fresh IPD placeholder
            }
        }

        invoiceRepository.save(Invoice.builder()
                .invoiceNumber("IPD-" + admissionNumber)
                .hospital(hospital)
                .patient(patient)
                .admission(admission)
                .subtotal(BigDecimal.ZERO)
                .tax(BigDecimal.ZERO)
                .discount(BigDecimal.ZERO)
                .total(BigDecimal.ZERO)
                .status(InvoiceStatus.UNPAID)
                .notes("IPD Admission — " + admissionNumber)
                .build());
    }

    // ── Two-stage OPD invoice creation ─────────────────────────────────────────
    // CONFIRMED → createAppointmentInvoice(id, false) : ₹0 placeholder, no items
    // COMPLETED → createAppointmentInvoice(id, true)  : adds consultation fee to existing (or new) invoice
    @Transactional
    public void createAppointmentInvoice(UUID appointmentId, boolean includeConsultation) {
        Appointment appt = appointmentRepository.findById(appointmentId).orElse(null);
        if (appt == null || appt.getHospital() == null || appt.getPatient() == null) return;

        String invoiceNum = "OPD-" + appointmentId.toString().replace("-", "").substring(0, 12).toUpperCase();
        Optional<Invoice> existing = invoiceRepository.findByAppointment_Id(appointmentId);

        if (existing.isPresent()) {
            if (!includeConsultation) return;
            Invoice invoice = existing.get();
            if (InvoiceStatus.PAID.equals(invoice.getStatus())) return;
            boolean alreadyHasFee = invoice.getItems() != null && invoice.getItems().stream()
                    .anyMatch(i -> "CONSULTATION".equals(i.getItemType()));
            if (alreadyHasFee) return;
            Doctor doc = appt.getDoctor();
            if (doc == null) return;
            BigDecimal fee = doc.getConsultationFee() != null ? doc.getConsultationFee() : BigDecimal.ZERO;
            if (fee.compareTo(BigDecimal.ZERO) == 0) return;
            String docName = doc.getUser() != null
                    ? doc.getUser().getFirstName() + " " + doc.getUser().getLastName() : "Doctor";
            if (invoice.getItems() == null) invoice.setItems(new ArrayList<>());
            invoice.getItems().add(InvoiceItem.builder()
                    .invoice(invoice)
                    .itemType("CONSULTATION")
                    .description("Consultation - Dr. " + docName)
                    .quantity(1)
                    .unitPrice(fee)
                    .totalPrice(fee)
                    .appointmentId(appt.getId())
                    .build());
            BigDecimal newSubtotal = invoice.getSubtotal().add(fee);
            invoice.setSubtotal(newSubtotal);
            invoice.setTotal(newSubtotal.add(invoice.getTax() != null ? invoice.getTax() : BigDecimal.ZERO)
                    .subtract(invoice.getDiscount() != null ? invoice.getDiscount() : BigDecimal.ZERO));
            invoice.setUpdatedAt(LocalDateTime.now());
            invoiceRepository.save(invoice);
            appt.setStatus(Appointment.AppointmentStatus.BILLED);
            appointmentRepository.save(appt);
        } else {
            if (includeConsultation && appt.getDoctor() != null) {
                Doctor doc = appt.getDoctor();
                BigDecimal fee = doc.getConsultationFee() != null ? doc.getConsultationFee() : BigDecimal.ZERO;
                String docName = doc.getUser() != null
                        ? doc.getUser().getFirstName() + " " + doc.getUser().getLastName() : "Doctor";
                Invoice invoice = Invoice.builder()
                        .invoiceNumber(invoiceNum)
                        .hospital(appt.getHospital())
                        .patient(appt.getPatient())
                        .appointment(appt)
                        .subtotal(fee)
                        .tax(BigDecimal.ZERO)
                        .discount(BigDecimal.ZERO)
                        .total(fee)
                        .status(InvoiceStatus.UNPAID)
                        .build();
                invoice.setItems(new ArrayList<>(List.of(InvoiceItem.builder()
                        .invoice(invoice)
                        .itemType("CONSULTATION")
                        .description("Consultation - Dr. " + docName)
                        .quantity(1)
                        .unitPrice(fee)
                        .totalPrice(fee)
                        .appointmentId(appt.getId())
                        .build())));
                invoiceRepository.save(invoice);
            } else {
                invoiceRepository.save(Invoice.builder()
                        .invoiceNumber(invoiceNum)
                        .hospital(appt.getHospital())
                        .patient(appt.getPatient())
                        .appointment(appt)
                        .subtotal(BigDecimal.ZERO)
                        .tax(BigDecimal.ZERO)
                        .discount(BigDecimal.ZERO)
                        .total(BigDecimal.ZERO)
                        .status(InvoiceStatus.UNPAID)
                        .notes("OPD Appointment — pending consultation")
                        .build());
            }
        }
    }

    @Transactional
    public void updateEstimatedTotal(UUID invoiceId, BigDecimal estimatedTotal) {
        invoiceRepository.findById(invoiceId).ifPresent(invoice -> {
            if (InvoiceStatus.PAID.equals(invoice.getStatus())) return;
            invoice.setSubtotal(estimatedTotal);
            invoice.setTotal(estimatedTotal);
            invoice.setUpdatedAt(LocalDateTime.now());
            invoiceRepository.save(invoice);
        });
    }

    // ── Remove consultation from invoice when appointment is CANCELLED ─────────
    @Transactional
    public void cancelAppointmentInvoice(UUID appointmentId) {
        Optional<Invoice> opt = invoiceRepository.findByAppointment_Id(appointmentId);
        if (opt.isEmpty()) return;
        Invoice invoice = opt.get();
        if (InvoiceStatus.PAID.equals(invoice.getStatus())) return;
        // If this appointment's invoice was absorbed into an IPD admission (OPD→IPD conversion),
        // do NOT touch it — the IPD invoice lifecycle is managed through the discharge flow.
        // Deleting or stripping items here would break the discharge gate.
        if (invoice.getAdmission() != null) return;
        if (invoice.getItems() != null) {
            invoice.getItems().removeIf(i -> "CONSULTATION".equals(i.getItemType()));
        }
        if (invoice.getItems() == null || invoice.getItems().isEmpty()) {
            invoiceRepository.delete(invoice);
        } else {
            BigDecimal newSubtotal = invoice.getItems().stream()
                    .map(InvoiceItem::getTotalPrice)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            invoice.setSubtotal(newSubtotal);
            invoice.setTotal(newSubtotal
                    .add(invoice.getTax() != null ? invoice.getTax() : BigDecimal.ZERO)
                    .subtract(invoice.getDiscount() != null ? invoice.getDiscount() : BigDecimal.ZERO));
            invoice.setUpdatedAt(LocalDateTime.now());
            invoiceRepository.save(invoice);
        }
    }

    // ── Return the invoice linked to an admission ──────────────────────────────
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Optional<InvoiceDTO> getAdmissionInvoice(UUID admissionId) {
        return invoiceRepository.findByAdmission_Id(admissionId).map(this::toDTO);
    }

    // ── Replace all items on an IPD invoice and recalculate totals ─────────────
    @Transactional
    public InvoiceDTO finalizeIPDInvoice(UUID invoiceId, InvoiceRequest req) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found"));
        // Allow re-saving a PARTIAL bill; block only fully PAID invoices
        if (InvoiceStatus.PAID.equals(invoice.getStatus())) {
            throw new RuntimeException("Cannot modify a paid invoice");
        }
        if (invoice.getItems() != null) {
            invoice.getItems().clear();
        } else {
            invoice.setItems(new ArrayList<>());
        }
        if (req.getItems() != null) {
            req.getItems().forEach(ir -> invoice.getItems().add(InvoiceItem.builder()
                    .invoice(invoice)
                    .serviceId(ir.getServiceId())
                    .radiologyOrderId(ir.getRadiologyOrderId())
                    .appointmentId(ir.getAppointmentId())
                    .itemType(ir.getItemType())
                    .description(ir.getDescription())
                    .quantity(ir.getQuantity())
                    .unitPrice(ir.getUnitPrice())
                    .totalPrice(ir.getTotalPrice())
                    .build()));
        }
        invoice.setSubtotal(req.getSubtotal() != null ? req.getSubtotal() : BigDecimal.ZERO);
        invoice.setTax(req.getTax() != null ? req.getTax() : BigDecimal.ZERO);
        invoice.setDiscount(req.getDiscount() != null ? req.getDiscount() : BigDecimal.ZERO);
        invoice.setAdvanceAdjusted(req.getAdvanceAdjusted() != null ? req.getAdvanceAdjusted() : BigDecimal.ZERO);
        // total = balance due after advance and discount
        invoice.setTotal(req.getTotal() != null ? req.getTotal() : BigDecimal.ZERO);
        if (req.getNotes() != null) invoice.setNotes(req.getNotes());
        invoice.setUpdatedAt(LocalDateTime.now());
        Invoice saved = invoiceRepository.save(invoice);

        // Mark advances applied if any were deducted
        if (invoice.getAdmission() != null && invoice.getAdvanceAdjusted().compareTo(BigDecimal.ZERO) > 0) {
            try {
                patientAdvanceService.markAdvancesApplied(
                        invoice.getAdmission().getId(), invoice.getId(), invoice.getAdvanceAdjusted());
            } catch (Exception ignored) {}
        }
        // Mark linked appointments and radiology orders as BILLED
        saved.getItems().stream()
                .filter(i -> "CONSULTATION".equals(i.getItemType()) && i.getAppointmentId() != null)
                .forEach(i -> appointmentRepository.findById(i.getAppointmentId())
                        .ifPresent(a -> { a.setStatus(Appointment.AppointmentStatus.BILLED); appointmentRepository.save(a); }));
        saved.getItems().stream()
                .filter(i -> "RADIOLOGY".equals(i.getItemType()) && i.getRadiologyOrderId() != null)
                .forEach(i -> radiologyOrderRepository.findById(i.getRadiologyOrderId())
                        .ifPresent(o -> { o.setStatus(RadiologyStatus.BILLED); radiologyOrderRepository.save(o); }));
        return toDTO(saved);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public InvoiceDTO getInvoiceDetail(UUID id) {
        Invoice invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Invoice not found"));
        return toDTO(invoice);
    }

    @Transactional
    public InvoiceDTO applyWaiver(UUID invoiceId, UUID itemId, java.math.BigDecimal waiverAmount, String waiverReason) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found"));
        if (InvoiceStatus.PAID.equals(invoice.getStatus())) {
            throw new RuntimeException("Cannot modify a paid invoice");
        }
        InvoiceItem target = invoice.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Invoice item not found"));

        java.math.BigDecimal safe = waiverAmount
                .max(java.math.BigDecimal.ZERO)
                .min(target.getTotalPrice());
        target.setWaiverAmount(safe);
        target.setWaiverReason(waiverReason);

        java.math.BigDecimal totalWaiver = invoice.getItems().stream()
                .map(i -> i.getWaiverAmount() != null ? i.getWaiverAmount() : java.math.BigDecimal.ZERO)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        invoice.setDiscount(totalWaiver);
        invoice.setTotal(invoice.getSubtotal().add(invoice.getTax()).subtract(totalWaiver));
        invoice.setUpdatedAt(LocalDateTime.now());

        invoiceRepository.save(invoice);
        return toDTO(invoice);
    }

    private InvoiceDTO toDTO(Invoice inv) {
        return InvoiceDTO.builder()
                .id(inv.getId().toString())
                .invoiceNumber(inv.getInvoiceNumber())
                .patientId(inv.getPatient() != null ? inv.getPatient().getId() : null)
                .patientName(inv.getPatient() != null
                        ? inv.getPatient().getFirstName() + " " + inv.getPatient().getLastName() : null)
                .patientMrn(inv.getPatient() != null ? inv.getPatient().getMrn() : null)
                .admissionId(inv.getAdmission() != null ? inv.getAdmission().getId() : null)
                .admissionNumber(inv.getAdmission() != null ? inv.getAdmission().getAdmissionNumber() : null)
                .subtotal(inv.getSubtotal())
                .tax(inv.getTax())
                .discount(inv.getDiscount())
                .total(inv.getTotal())
                .paymentMethod(inv.getPaymentMethod())
                .notes(inv.getNotes())
                .status(inv.getStatus().name())
                .advanceAdjusted(inv.getAdvanceAdjusted())
                .paidAmount(inv.getPaidAmount())
                .createdAt(inv.getCreatedAt())
                .updatedAt(inv.getUpdatedAt())
                .items(inv.getItems() != null ? inv.getItems().stream().map(item ->
                        InvoiceDTO.ItemDTO.builder()
                                .id(item.getId())
                                .itemType(item.getItemType())
                                .description(item.getDescription())
                                .quantity(item.getQuantity())
                                .unitPrice(item.getUnitPrice())
                                .totalPrice(item.getTotalPrice())
                                .waiverAmount(item.getWaiverAmount())
                                .waiverReason(item.getWaiverReason())
                                .serviceId(item.getServiceId())
                                .radiologyOrderId(item.getRadiologyOrderId())
                                .appointmentId(item.getAppointmentId())
                                .build()
                ).collect(Collectors.toList()) : java.util.Collections.emptyList())
                .payments(invoicePaymentRepository.findByInvoice_IdOrderByPaidAtAsc(inv.getId())
                        .stream().map(p -> InvoiceDTO.PaymentDTO.builder()
                                .id(p.getId())
                                .amount(p.getAmount())
                                .paymentMethod(p.getPaymentMethod())
                                .collectedBy(p.getCollectedBy())
                                .paidAt(p.getPaidAt())
                                .build()
                        ).collect(Collectors.toList()))
                .build();
    }
}
