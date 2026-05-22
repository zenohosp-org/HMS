package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.InvoiceDTO;
import com.zenlocare.HMS_backend.dto.InvoiceRequest;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.entity.Appointment;
import com.zenlocare.HMS_backend.entity.InvoicePayment;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.HashMap;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import java.util.stream.Collectors;

@Slf4j
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
    private final BankLedgerService bankLedgerService;
    private final PatientServiceRepository patientServiceRepository;

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
        if (InvoiceStatus.PAID.equals(invoice.getStatus()) || InvoiceStatus.SETTLED.equals(invoice.getStatus())) {
            throw new RuntimeException("Invoice is already paid");
        }
        invoice.setStatus(invoice.getAdmission() != null ? InvoiceStatus.SETTLED : InvoiceStatus.PAID);
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
        if (InvoiceStatus.PAID.equals(invoice.getStatus()) || InvoiceStatus.SETTLED.equals(invoice.getStatus())) {
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

        boolean isIpd = invoice.getAdmission() != null;
        invoice.setStatus(fullyPaid
                ? (isIpd ? InvoiceStatus.SETTLED  : InvoiceStatus.PAID)
                : (isIpd ? InvoiceStatus.UNSETTLED : InvoiceStatus.PARTIAL));

        if (fullyPaid && isIpd && advance.compareTo(BigDecimal.ZERO) > 0) {
            try {
                patientAdvanceService.markAdvancesApplied(
                        invoice.getAdmission().getId(), invoice.getId(), advance);
            } catch (Exception ignored) {}
        }

        if (bankAccountId != null) {
            try { bankLedgerService.creditPayment(bankAccountId, amount,
                    "Payment — " + invoice.getInvoiceNumber(), invoice.getInvoiceNumber(), invoice.getId());
            } catch (Exception ignored) {}
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
        if (!invoiceRepository.findAllByAdmission_IdOrderByCreatedAtDesc(admissionId).isEmpty()) return;
        Hospital hospital = hospitalRepository.findById(hospitalId).orElse(null);
        Patient patient = patientRepository.findById(patientId).orElse(null);
        Admission admission = admissionRepository.findById(admissionId).orElse(null);
        if (hospital == null || patient == null || admission == null) return;

        // Absorb the OPD invoice when this admission was triggered from an OPD appointment.
        // Same logic as before — restoring the original behaviour with diagnostic logging only.
        if (sourceAppointmentId != null) {
            Optional<Invoice> opdOpt = invoiceRepository.findByAppointment_Id(sourceAppointmentId);
            if (opdOpt.isPresent()) {
                Invoice opdInvoice = opdOpt.get();
                if (isCollectible(opdInvoice)) {
                    opdInvoice.setAdmission(admission);
                    opdInvoice.setInvoiceNumber(HospitalIdPrefix.of(hospital) + "IPD-"
                            + HospitalIdPrefix.stripHospitalPrefix(admissionNumber));
                    opdInvoice.setNotes("IPD Admission (converted from OPD) — " + admissionNumber);
                    opdInvoice.setUpdatedAt(LocalDateTime.now());
                    try {
                        invoiceRepository.saveAndFlush(opdInvoice);
                    } catch (org.springframework.orm.ObjectOptimisticLockingFailureException e) {
                        // Another transaction modified this invoice concurrently. Don't retry blindly —
                        // surface to caller so the admit-side flow can handle (or the user can retry).
                        log.warn("OPD→IPD merge: optimistic lock on invoice {} during admission {} — aborting merge",
                                opdInvoice.getId(), admissionId);
                        throw e;
                    }
                    log.info("OPD→IPD merge: invoice {} promoted to IPD for admission {} (appt {})",
                            opdInvoice.getId(), admissionId, sourceAppointmentId);
                    return;
                }
                log.info("OPD→IPD merge skipped: appt {}'s invoice {} is in non-collectible status {}",
                        sourceAppointmentId, opdInvoice.getId(), opdInvoice.getStatus());
                // Fall through and create a fresh IPD placeholder
            } else {
                log.warn("OPD→IPD merge: no invoice found for source appointment {} — creating fresh IPD invoice for admission {}",
                        sourceAppointmentId, admissionId);
            }
        } else {
            log.info("OPD→IPD merge: admission {} has no sourceAppointmentId — creating fresh IPD invoice", admissionId);
        }

        // Direct IPD admission (no OPD source) — add one-time registration fee if never charged
        Optional<BigDecimal> regFeeOpt = findRegistrationFee(hospitalId);
        BigDecimal regFee = regFeeOpt.orElse(null);
        boolean addReg = regFee != null
                && !invoiceRepository.existsRegistrationFeeForPatient(patientId);
        // Strip embedded hospital prefix from admissionNumber so the invoice number has the
        // hospital code at the START exactly once: e.g. "1001-IPD-ADM-2026-0001"
        Invoice admissionInvoice = Invoice.builder()
                .invoiceNumber(HospitalIdPrefix.of(hospital) + "IPD-"
                        + HospitalIdPrefix.stripHospitalPrefix(admissionNumber))
                .hospital(hospital)
                .patient(patient)
                .admission(admission)
                .subtotal(addReg ? regFee : BigDecimal.ZERO)
                .tax(BigDecimal.ZERO)
                .discount(BigDecimal.ZERO)
                .total(addReg ? regFee : BigDecimal.ZERO)
                .status(InvoiceStatus.UNSETTLED)
                .notes("IPD Admission — " + admissionNumber)
                .build();
        if (addReg) {
            admissionInvoice.setItems(new ArrayList<>(List.of(InvoiceItem.builder()
                    .invoice(admissionInvoice)
                    .itemType("REGISTRATION")
                    .description("Registration Fee")
                    .quantity(1)
                    .unitPrice(regFee)
                    .totalPrice(regFee)
                    .build())));
        }
        invoiceRepository.save(admissionInvoice);
    }

    // ── Two-stage OPD invoice creation ─────────────────────────────────────────
    // CONFIRMED → createAppointmentInvoice(id, false) : ₹0 placeholder, no items
    // COMPLETED → createAppointmentInvoice(id, true)  : adds consultation fee to existing (or new) invoice
    @Transactional
    public void createAppointmentInvoice(UUID appointmentId, boolean includeConsultation) {
        Appointment appt = appointmentRepository.findById(appointmentId).orElse(null);
        if (appt == null || appt.getHospital() == null || appt.getPatient() == null) return;

        String invoiceNum = HospitalIdPrefix.of(appt.getHospital())
                + "OPD-" + appointmentId.toString().replace("-", "").substring(0, 12).toUpperCase();
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
            boolean isFollowUp = appt.getType() == Appointment.AppointmentType.FOLLOWUP;
            BigDecimal fee = (isFollowUp && doc.getFollowUpFee() != null && doc.getFollowUpFee().compareTo(BigDecimal.ZERO) > 0)
                    ? doc.getFollowUpFee()
                    : (doc.getConsultationFee() != null ? doc.getConsultationFee() : BigDecimal.ZERO);
            if (fee.compareTo(BigDecimal.ZERO) == 0) return;
            String feeLabel = isFollowUp ? "Follow-up" : "Consultation";
            String docName = doc.getUser() != null
                    ? doc.getUser().getFirstName() + " " + doc.getUser().getLastName() : "Doctor";
            if (invoice.getItems() == null) invoice.setItems(new ArrayList<>());
            invoice.getItems().add(InvoiceItem.builder()
                    .invoice(invoice)
                    .itemType("CONSULTATION")
                    .description(feeLabel + " - Dr. " + docName)
                    .quantity(1)
                    .unitPrice(fee)
                    .totalPrice(fee)
                    .appointmentId(appt.getId())
                    .build());
            BigDecimal newSubtotal = invoice.getSubtotal().add(fee);
            // Add one-time registration fee if this patient has never been charged it
            Optional<BigDecimal> regFeeOptE = findRegistrationFee(appt.getHospital().getId());
            if (regFeeOptE.isPresent()
                    && !invoiceRepository.existsRegistrationFeeForPatient(appt.getPatient().getId())) {
                BigDecimal regFee = regFeeOptE.get();
                invoice.getItems().add(InvoiceItem.builder()
                        .invoice(invoice)
                        .itemType("REGISTRATION")
                        .description("Registration Fee")
                        .quantity(1)
                        .unitPrice(regFee)
                        .totalPrice(regFee)
                        .build());
                newSubtotal = newSubtotal.add(regFee);
            }
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
                boolean isFollowUp = appt.getType() == Appointment.AppointmentType.FOLLOWUP;
                BigDecimal fee = (isFollowUp && doc.getFollowUpFee() != null && doc.getFollowUpFee().compareTo(BigDecimal.ZERO) > 0)
                        ? doc.getFollowUpFee()
                        : (doc.getConsultationFee() != null ? doc.getConsultationFee() : BigDecimal.ZERO);
                String feeLabel = isFollowUp ? "Follow-up" : "Consultation";
                String docName = doc.getUser() != null
                        ? doc.getUser().getFirstName() + " " + doc.getUser().getLastName() : "Doctor";
                List<InvoiceItem> newItems = new ArrayList<>();
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
                newItems.add(InvoiceItem.builder()
                        .invoice(invoice)
                        .itemType("CONSULTATION")
                        .description(feeLabel + " - Dr. " + docName)
                        .quantity(1)
                        .unitPrice(fee)
                        .totalPrice(fee)
                        .appointmentId(appt.getId())
                        .build());
                // Add one-time registration fee if this patient has never been charged it
                Optional<BigDecimal> regFeeOptN = findRegistrationFee(appt.getHospital().getId());
                if (regFeeOptN.isPresent()
                        && !invoiceRepository.existsRegistrationFeeForPatient(appt.getPatient().getId())) {
                    BigDecimal regFee = regFeeOptN.get();
                    newItems.add(InvoiceItem.builder()
                            .invoice(invoice)
                            .itemType("REGISTRATION")
                            .description("Registration Fee")
                            .quantity(1)
                            .unitPrice(regFee)
                            .totalPrice(regFee)
                            .build());
                    invoice.setSubtotal(fee.add(regFee));
                    invoice.setTotal(fee.add(regFee));
                }
                invoice.setItems(newItems);
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
            if (InvoiceStatus.PAID.equals(invoice.getStatus()) || InvoiceStatus.SETTLED.equals(invoice.getStatus())) return;
            // Add items already committed to this invoice (e.g., consultation fee carried over
            // from a promoted OPD invoice) so the billing-list total stays accurate before
            // the user opens and finalizes the IPD Bill modal.
            // ROOM_CHARGE and CUSTOM are excluded because estimatedTotal already covers them.
            BigDecimal committedItemsTotal = invoice.getItems() != null
                    ? invoice.getItems().stream()
                            .filter(i -> !"ROOM_CHARGE".equals(i.getItemType()) && !"CUSTOM".equals(i.getItemType()))
                            .map(InvoiceItem::getTotalPrice)
                            .filter(Objects::nonNull)
                            .reduce(BigDecimal.ZERO, BigDecimal::add)
                    : BigDecimal.ZERO;
            BigDecimal newTotal = committedItemsTotal.add(estimatedTotal);
            invoice.setSubtotal(newTotal);
            invoice.setTotal(newTotal);
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
        if (InvoiceStatus.PAID.equals(invoice.getStatus()) || InvoiceStatus.SETTLED.equals(invoice.getStatus())) return;
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
        return invoiceRepository.findAllByAdmission_IdOrderByCreatedAtDesc(admissionId)
                .stream().findFirst().map(this::toDTO);
    }

    // ── Open OPD bills for a patient — used by the admit modal's merge picker ──
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<InvoiceDTO> getOpenOpdInvoicesForPatient(UUID hospitalId, Integer patientId) {
        return invoiceRepository.findOpenOpdInvoicesForPatient(hospitalId, patientId)
                .stream().map(this::toDTO).toList();
    }

    // ── Replace all items on an IPD invoice and recalculate totals ─────────────
    @Transactional
    public InvoiceDTO finalizeIPDInvoice(UUID invoiceId, InvoiceRequest req) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found"));
        // Reopening a SETTLED bill (new charges added while patient still admitted) — reset to UNSETTLED.
        // Discharge gate enforces that the patient cannot leave until balance is zero again.
        if (InvoiceStatus.PAID.equals(invoice.getStatus()) || InvoiceStatus.SETTLED.equals(invoice.getStatus())) {
            invoice.setStatus(InvoiceStatus.UNSETTLED);
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

    // ── Atomic: update bill items + record payment in one transaction ────────────
    @Transactional
    public InvoiceDTO collectAndSave(UUID invoiceId, InvoiceRequest itemsReq,
                                     BigDecimal amount, String paymentMethod,
                                     UUID bankAccountId, String collectedBy) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Invoice not found"));

        // Reset SETTLED → UNSETTLED so new charges can be applied (discharge gate is the real lock)
        if (InvoiceStatus.PAID.equals(invoice.getStatus()) || InvoiceStatus.SETTLED.equals(invoice.getStatus())) {
            invoice.setStatus(InvoiceStatus.UNSETTLED);
        }

        // Replace items
        if (invoice.getItems() != null) invoice.getItems().clear();
        else invoice.setItems(new ArrayList<>());
        if (itemsReq.getItems() != null) {
            itemsReq.getItems().forEach(ir -> invoice.getItems().add(InvoiceItem.builder()
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
        invoice.setSubtotal(itemsReq.getSubtotal() != null ? itemsReq.getSubtotal() : BigDecimal.ZERO);
        invoice.setTax(itemsReq.getTax() != null ? itemsReq.getTax() : BigDecimal.ZERO);
        invoice.setDiscount(itemsReq.getDiscount() != null ? itemsReq.getDiscount() : BigDecimal.ZERO);
        invoice.setAdvanceAdjusted(itemsReq.getAdvanceAdjusted() != null ? itemsReq.getAdvanceAdjusted() : BigDecimal.ZERO);
        invoice.setTotal(itemsReq.getTotal() != null ? itemsReq.getTotal() : BigDecimal.ZERO);
        if (itemsReq.getNotes() != null) invoice.setNotes(itemsReq.getNotes());

        // Record payment
        invoicePaymentRepository.save(InvoicePayment.builder()
                .invoice(invoice)
                .amount(amount)
                .paymentMethod(paymentMethod)
                .bankAccountId(bankAccountId)
                .collectedBy(collectedBy)
                .build());

        BigDecimal newPaid = (invoice.getPaidAmount() != null ? invoice.getPaidAmount() : BigDecimal.ZERO).add(amount);
        invoice.setPaidAmount(newPaid);
        invoice.setUpdatedAt(LocalDateTime.now());

        BigDecimal advance = invoice.getAdvanceAdjusted() != null ? invoice.getAdvanceAdjusted() : BigDecimal.ZERO;
        BigDecimal total = invoice.getTotal() != null ? invoice.getTotal() : BigDecimal.ZERO;
        boolean fullyPaid = newPaid.add(advance).compareTo(total) >= 0;
        // collectAndSave is exclusively called for IPD invoices — always use SETTLED/UNSETTLED
        invoice.setStatus(fullyPaid ? InvoiceStatus.SETTLED : InvoiceStatus.UNSETTLED);

        if (fullyPaid && invoice.getAdmission() != null && advance.compareTo(BigDecimal.ZERO) > 0) {
            try { patientAdvanceService.markAdvancesApplied(invoice.getAdmission().getId(), invoice.getId(), advance); }
            catch (Exception ignored) {}
        }

        if (bankAccountId != null) {
            try { bankLedgerService.creditPayment(bankAccountId, amount,
                    "Payment — " + invoice.getInvoiceNumber(), invoice.getInvoiceNumber(), invoice.getId());
            } catch (Exception ignored) {}
        }

        Invoice saved = invoiceRepository.save(invoice);

        // Mark consultations and radiology as BILLED
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
        if (InvoiceStatus.PAID.equals(invoice.getStatus()) || InvoiceStatus.SETTLED.equals(invoice.getStatus())) {
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

    // Look up the hospital's active one-time REGISTRATION patient service price.
    // Returns empty if not configured — registration fee is skipped in that case.
    private Optional<BigDecimal> findRegistrationFee(UUID hospitalId) {
        return patientServiceRepository.findByHospitalId(hospitalId).stream()
                .filter(s -> com.zenlocare.HMS_backend.entity.PatientService.ServiceType.REGISTRATION == s.getType()
                          && Boolean.TRUE.equals(s.getOneTimeCharge())
                          && Boolean.TRUE.equals(s.getIsActive()))
                .map(com.zenlocare.HMS_backend.entity.PatientService::getPricePerDay)
                .filter(p -> p != null && p.compareTo(BigDecimal.ZERO) > 0)
                .findFirst();
    }

    private InvoiceDTO toDTO(Invoice inv) {
        return InvoiceDTO.builder()
                .id(inv.getId().toString())
                .invoiceNumber(inv.getInvoiceNumber())
                .patientId(inv.getPatient() != null ? inv.getPatient().getId() : null)
                .patientName(inv.getPatient() != null
                        ? inv.getPatient().getFirstName() + " " + inv.getPatient().getLastName() : null)
                .patientUhid(inv.getPatient() != null ? inv.getPatient().getUhid() : null)
                .admissionId(inv.getAdmission() != null ? inv.getAdmission().getId() : null)
                .admissionNumber(inv.getAdmission() != null ? inv.getAdmission().getAdmissionNumber() : null)
                .appointmentId(inv.getAppointment() != null ? inv.getAppointment().getId() : null)
                .appointmentDate(inv.getAppointment() != null && inv.getAppointment().getApptDate() != null && inv.getAppointment().getApptTime() != null
                        ? LocalDateTime.of(inv.getAppointment().getApptDate(), inv.getAppointment().getApptTime())
                        : null)
                .appointmentDoctorName(inv.getAppointment() != null && inv.getAppointment().getDoctor() != null && inv.getAppointment().getDoctor().getUser() != null
                        ? inv.getAppointment().getDoctor().getUser().getFirstName() + " " + inv.getAppointment().getDoctor().getUser().getLastName()
                        : null)
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
                        new InvoiceDTO.ItemDTO(
                                item.getId(),
                                item.getItemType(),
                                item.getDescription(),
                                item.getQuantity(),
                                item.getUnitPrice(),
                                item.getTotalPrice(),
                                item.getWaiverAmount(),
                                item.getWaiverReason(),
                                item.getServiceId(),
                                item.getRadiologyOrderId(),
                                item.getAppointmentId(),
                                item.getAmbulanceBookingId()
                        )
                ).collect(Collectors.toList()) : java.util.Collections.emptyList())
                .payments(invoicePaymentRepository.findByInvoice_IdOrderByPaidAtAsc(inv.getId())
                        .stream().map(p -> new InvoiceDTO.PaymentDTO(
                                p.getId(),
                                p.getAmount(),
                                p.getPaymentMethod(),
                                p.getCollectedBy(),
                                p.getPaidAt()
                        )).collect(Collectors.toList()))
                .build();
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Map<String, Object> getPaginatedOpdInvoices(
        UUID hospitalId, int page, int size, String status, String search
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        String safeSearch = (search == null) ? "" : search.trim();
        String safeStatus = (status == null || status.isBlank()) ? "ALL" : status.trim();

        Page<Invoice> result = invoiceRepository.searchOpdInvoices(
            hospitalId, safeStatus, safeSearch, pageable
        );

        return buildPageResponse(result);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Map<String, Object> getPaginatedIpdInvoices(
        UUID hospitalId, int page, int size, String status, String search
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        String safeSearch = (search == null) ? "" : search.trim();
        String safeStatus = (status == null || status.isBlank()) ? "ALL" : status.trim();

        Page<Invoice> result = invoiceRepository.searchIpdInvoices(
            hospitalId, safeStatus, safeSearch, pageable
        );

        return buildPageResponse(result);
    }

    private Map<String, Object> buildPageResponse(Page<Invoice> result) {
        Map<String, Object> response = new HashMap<>();
        List<InvoiceDTO> dtos = result.getContent().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        response.put("invoices", dtos);
        response.put("totalElements", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        response.put("currentPage", result.getNumber());
        return response;
    }

    /**
     * Auto-adds an ambulance charge as a line item to the patient's active IPD invoice
     * when the booking is marked COMPLETED with reachedToSameHospital = true.
     * Idempotent: no-op if the booking is already present in the invoice.
     */
    @Transactional
    public void addAmbulanceItemToIpdInvoice(Integer patientId, Long bookingId,
                                              java.math.BigDecimal charge, String description) {
        if (patientId == null || charge == null) return;

        // Find the most recent IPD (admission-linked) invoice for this patient
        Invoice invoice = invoiceRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .filter(i -> i.getAdmission() != null)
                .filter(i -> !InvoiceStatus.CANCELLED.equals(i.getStatus()))
                .findFirst()
                .orElse(null);

        if (invoice == null) return; // Patient has no active IPD invoice — skip

        // Idempotency: already added
        boolean alreadyPresent = invoice.getItems() != null && invoice.getItems().stream()
                .anyMatch(it -> bookingId.equals(it.getAmbulanceBookingId()));
        if (alreadyPresent) return;

        if (invoice.getItems() == null) invoice.setItems(new java.util.ArrayList<>());

        InvoiceItem item = InvoiceItem.builder()
                .invoice(invoice)
                .itemType("AMBULANCE")
                .ambulanceBookingId(bookingId)
                .description(description != null ? description : "Ambulance Service")
                .quantity(1)
                .unitPrice(charge)
                .totalPrice(charge)
                .build();
        invoice.getItems().add(item);

        // Recalculate subtotal and balance due
        java.math.BigDecimal subtotal = invoice.getItems().stream()
                .map(it -> it.getTotalPrice() != null ? it.getTotalPrice() : java.math.BigDecimal.ZERO)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        invoice.setSubtotal(subtotal);

        java.math.BigDecimal tax      = invoice.getTax()            != null ? invoice.getTax()            : java.math.BigDecimal.ZERO;
        java.math.BigDecimal discount = invoice.getDiscount()       != null ? invoice.getDiscount()       : java.math.BigDecimal.ZERO;
        java.math.BigDecimal advance  = invoice.getAdvanceAdjusted()!= null ? invoice.getAdvanceAdjusted(): java.math.BigDecimal.ZERO;
        java.math.BigDecimal paid     = invoice.getPaidAmount()     != null ? invoice.getPaidAmount()     : java.math.BigDecimal.ZERO;
        invoice.setTotal(subtotal.add(tax).subtract(discount).subtract(advance).subtract(paid));

        // Re-open the invoice if it was fully settled so staff can see the new item
        if (InvoiceStatus.PAID.equals(invoice.getStatus()) || InvoiceStatus.SETTLED.equals(invoice.getStatus())) {
            invoice.setStatus(InvoiceStatus.UNSETTLED);
        }

        invoice.setUpdatedAt(LocalDateTime.now());
        invoiceRepository.save(invoice);
    }

    private boolean isCollectible(Invoice inv) {
        InvoiceStatus s = inv.getStatus();
        return s != null
                && !InvoiceStatus.PAID.equals(s)
                && !InvoiceStatus.SETTLED.equals(s)
                && !InvoiceStatus.CANCELLED.equals(s);
    }
}
