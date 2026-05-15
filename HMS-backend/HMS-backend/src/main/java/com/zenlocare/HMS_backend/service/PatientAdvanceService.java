package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PatientAdvanceService {

    private final PatientAdvanceRepository patientAdvanceRepository;
    private final PatientRepository patientRepository;
    private final HospitalRepository hospitalRepository;
    private final AdmissionRepository admissionRepository;
    private final BankAccountRepository bankAccountRepository;
    private final BankTransactionRepository bankTransactionRepository;

    // Called from PatientService when patient is registered and advance is collected
    @Transactional
    public PatientAdvance createRegistrationAdvance(Integer patientId, UUID hospitalId,
                                                     BigDecimal amount, String paymentMethod, String notes) {
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new RuntimeException("Patient not found"));
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new RuntimeException("Hospital not found"));

        String receiptNumber = generateReceiptNumber(patient);
        PatientAdvance advance = PatientAdvance.builder()
                .hospital(hospital)
                .patient(patient)
                .amount(amount)
                .paymentMethod(paymentMethod)
                .source(PatientAdvanceSource.REGISTRATION)
                .notes(notes)
                .receiptNumber(receiptNumber)
                .build();
        return patientAdvanceRepository.save(advance);
    }

    // Called from BillingController when admission advance is collected at Step 4
    @Transactional
    public PatientAdvance createAdmissionAdvance(UUID admissionId, BigDecimal amount,
                                                  String paymentMethod, UUID bankAccountId,
                                                  String notes, String collectedBy) {
        Admission admission = admissionRepository.findById(admissionId)
                .orElseThrow(() -> new RuntimeException("Admission not found"));
        Patient patient = admission.getPatient();

        String receiptNumber = generateReceiptNumber(patient);
        PatientAdvance advance = PatientAdvance.builder()
                .hospital(admission.getHospital())
                .patient(patient)
                .admission(admission)
                .amount(amount)
                .paymentMethod(paymentMethod)
                .bankAccountId(bankAccountId)
                .source(PatientAdvanceSource.ADMISSION)
                .notes(notes)
                .receiptNumber(receiptNumber)
                .collectedBy(collectedBy)
                .build();
        PatientAdvance saved = patientAdvanceRepository.save(advance);

        if (bankAccountId != null && amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
            creditBankAccount(bankAccountId, amount,
                    "Advance — " + receiptNumber, admission.getHospital().getId());
        }
        return saved;
    }

    // Auto-link any floating registration advances to this admission when patient is admitted
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void linkRegistrationAdvancesToAdmission(Integer patientId, UUID admissionId) {
        Admission admission = admissionRepository.findById(admissionId).orElse(null);
        if (admission == null) return;
        List<PatientAdvance> floating = patientAdvanceRepository
                .findByPatient_IdAndAdmission_IdIsNullAndAppliedFalse(patientId);
        floating.forEach(a -> {
            a.setAdmission(admission);
            patientAdvanceRepository.save(a);
        });
    }

    public List<PatientAdvance> listByAdmission(UUID admissionId) {
        return patientAdvanceRepository.findByAdmission_Id(admissionId);
    }

    public List<PatientAdvance> listByPatient(Integer patientId) {
        return patientAdvanceRepository.findByPatient_Id(patientId);
    }

    public BigDecimal totalByAdmission(UUID admissionId) {
        return patientAdvanceRepository.findByAdmission_Id(admissionId).stream()
                .map(a -> a.getAmount() != null ? a.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // Mark advances as applied when bill is finalized — called from InvoiceService.
    // REQUIRES_NEW ensures any failure here never poisons the caller's transaction.
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void markAdvancesApplied(UUID admissionId, UUID invoiceId, BigDecimal appliedTotal) {
        List<PatientAdvance> advances = patientAdvanceRepository.findByAdmission_IdAndAppliedFalse(admissionId);
        BigDecimal remaining = appliedTotal;
        for (PatientAdvance adv : advances) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
            BigDecimal use = remaining.min(adv.getAmount());
            adv.setApplied(use.compareTo(adv.getAmount()) >= 0);
            adv.setAppliedAmount(use);
            adv.setAppliedInvoiceId(invoiceId);
            patientAdvanceRepository.save(adv);
            remaining = remaining.subtract(use);
        }
    }

    public PatientAdvanceDTO toDTO(PatientAdvance a) {
        return PatientAdvanceDTO.builder()
                .id(a.getId().toString())
                .amount(a.getAmount())
                .paymentMethod(a.getPaymentMethod())
                .source(a.getSource().name())
                .receiptNumber(a.getReceiptNumber())
                .notes(a.getNotes())
                .applied(a.getApplied())
                .appliedAmount(a.getAppliedAmount())
                .collectedBy(a.getCollectedBy())
                .createdAt(a.getCreatedAt())
                .build();
    }

    private String generateReceiptNumber(Patient patient) {
        long seq = patientAdvanceRepository.countByPatient_Id(patient.getId()) + 1;
        return "ADV-" + patient.getMrn() + "-" + String.format("%03d", seq);
    }

    private void creditBankAccount(UUID bankAccountId, BigDecimal amount, String description, UUID hospitalId) {
        bankAccountRepository.findById(bankAccountId).ifPresent(account -> {
            bankTransactionRepository.save(BankTransaction.builder()
                    .hospitalId(hospitalId)
                    .bankAccountId(bankAccountId)
                    .amount(amount)
                    .type("CREDIT")
                    .description(description)
                    .transactionDate(LocalDateTime.now())
                    .build());
        });
    }

    // DTO returned by API
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class PatientAdvanceDTO {
        private String id;
        private java.math.BigDecimal amount;
        private String paymentMethod;
        private String source;
        private String receiptNumber;
        private String notes;
        private Boolean applied;
        private java.math.BigDecimal appliedAmount;
        private String collectedBy;
        private java.time.LocalDateTime createdAt;
    }
}
