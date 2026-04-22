package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.BankAccountDTO;
import com.zenlocare.HMS_backend.entity.BankAccount;
import com.zenlocare.HMS_backend.repository.BankAccountRepository;
import com.zenlocare.HMS_backend.repository.BankTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BankAccountService {

    private final BankAccountRepository accountRepository;
    private final BankTransactionRepository transactionRepository;

    public List<BankAccountDTO> listByHospital(UUID hospitalId) {
        return accountRepository.findByHospitalId(hospitalId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private BankAccountDTO toDTO(BankAccount a) {
        BigDecimal netMovement = transactionRepository.computeNetMovement(a.getId());
        BigDecimal currentBalance = a.getOpeningBalance().add(netMovement);
        return BankAccountDTO.builder()
                .id(a.getId())
                .accountName(a.getAccountName())
                .accountNumber(a.getAccountNumber())
                .accountType(a.getAccountType())
                .bankName(a.getBankName())
                .branch(a.getBranch())
                .ifscCode(a.getIfscCode())
                .isDefault(a.getIsDefault())
                .openingBalance(a.getOpeningBalance())
                .currentBalance(currentBalance)
                .build();
    }
}
