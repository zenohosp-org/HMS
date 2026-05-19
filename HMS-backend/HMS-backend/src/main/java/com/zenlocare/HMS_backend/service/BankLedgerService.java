package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.entity.BankTransaction;
import com.zenlocare.HMS_backend.repository.BankAccountRepository;
import com.zenlocare.HMS_backend.repository.BankTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Isolated bank ledger writes — always in their own transaction (REQUIRES_NEW)
 * so a schema mismatch or constraint failure never poisons the caller's transaction.
 */
@Transactional(readOnly = true)
@Service
@RequiredArgsConstructor
public class BankLedgerService {

    private final BankAccountRepository bankAccountRepository;
    private final BankTransactionRepository bankTransactionRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void creditPayment(UUID bankAccountId, BigDecimal amount,
                              String description, String referenceNo, UUID relatedEntityId) {
        bankAccountRepository.findById(bankAccountId).ifPresent(account ->
            bankTransactionRepository.save(BankTransaction.builder()
                    .hospitalId(account.getHospitalId())
                    .bankAccountId(bankAccountId)
                    .amount(amount)
                    .type("CREDIT")
                    .description(description)
                    .referenceNo(referenceNo)
                    .relatedEntityId(relatedEntityId)
                    .relatedEntityType("INVOICE")
                    .transactionDate(LocalDateTime.now())
                    .build()));
    }
}
