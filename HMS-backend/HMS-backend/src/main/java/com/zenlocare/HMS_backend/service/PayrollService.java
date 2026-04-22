package com.zenlocare.HMS_backend.service;

import com.zenlocare.HMS_backend.dto.PayrollRecordDTO;
import com.zenlocare.HMS_backend.dto.ProcessSalaryRequest;
import com.zenlocare.HMS_backend.dto.StaffPayrollDTO;
import com.zenlocare.HMS_backend.entity.*;
import com.zenlocare.HMS_backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PayrollService {

    private final UserRepository userRepository;
    private final StaffSalaryRepository salaryRepository;
    private final PayrollRecordRepository recordRepository;
    private final BankAccountRepository bankAccountRepository;
    private final BankTransactionRepository transactionRepository;

    public List<StaffPayrollDTO> listStaffWithSalaries(UUID hospitalId) {
        List<User> users = userRepository.findByHospitalId(hospitalId).stream()
                .filter(u -> u.getRole() != null && !u.getRole().getName().equalsIgnoreCase("super_admin"))
                .collect(Collectors.toList());

        Map<UUID, StaffSalary> salaryMap = salaryRepository.findByHospitalId(hospitalId)
                .stream().collect(Collectors.toMap(StaffSalary::getStaffId, s -> s));

        return users.stream().map(u -> {
            StaffSalary sal = salaryMap.get(u.getId());
            BigDecimal basicSalary = sal != null ? sal.getBasicSalary() : BigDecimal.ZERO;

            List<PayrollRecord> history = recordRepository
                    .findByHospitalIdAndStaffIdOrderByYearDescMonthDesc(hospitalId, u.getId());
            PayrollRecord last = history.isEmpty() ? null : history.get(0);

            String fullName = u.getFirstName() + (u.getLastName() != null ? " " + u.getLastName() : "");
            return StaffPayrollDTO.builder()
                    .staffId(u.getId())
                    .staffName(fullName)
                    .role(u.getRole().getName())
                    .department(u.getDesignation())
                    .basicSalary(basicSalary)
                    .lastPaidMonth(last != null ? last.getMonth() : null)
                    .lastPaidYear(last != null ? last.getYear() : null)
                    .lastNetPay(last != null ? last.getNetPay() : null)
                    .lastPaidAt(last != null ? last.getProcessedAt() : null)
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional
    public void updateSalary(UUID hospitalId, UUID staffId, BigDecimal basicSalary) {
        StaffSalary salary = salaryRepository
                .findByHospitalIdAndStaffId(hospitalId, staffId)
                .orElse(StaffSalary.builder().hospitalId(hospitalId).staffId(staffId).build());
        salary.setBasicSalary(basicSalary);
        salaryRepository.save(salary);
    }

    @Transactional
    public PayrollRecordDTO processSalary(ProcessSalaryRequest req, Authentication auth) {
        User actor = (User) auth.getPrincipal();

        // Prevent duplicate payment for same month/year
        recordRepository.findByHospitalIdAndStaffIdAndMonthAndYear(
                req.getHospitalId(), req.getStaffId(), req.getMonth(), req.getYear())
                .ifPresent(r -> { throw new RuntimeException("Salary already processed for this period"); });

        BigDecimal bonus = req.getBonus() != null ? req.getBonus() : BigDecimal.ZERO;
        BigDecimal deductions = req.getDeductions() != null ? req.getDeductions() : BigDecimal.ZERO;
        BigDecimal netPay = req.getBaseSalary().add(bonus).subtract(deductions);

        User staff = userRepository.findById(req.getStaffId())
                .orElseThrow(() -> new RuntimeException("Staff not found"));
        String staffName = staff.getFirstName() + (staff.getLastName() != null ? " " + staff.getLastName() : "");

        // Determine bank account label
        String bankAccountName = null;
        if (req.getBankAccountId() != null) {
            bankAccountName = bankAccountRepository.findById(req.getBankAccountId())
                    .map(BankAccount::getAccountName).orElse(null);
        }

        PayrollRecord record = PayrollRecord.builder()
                .hospitalId(req.getHospitalId())
                .staffId(req.getStaffId())
                .staffName(staffName)
                .role(staff.getRole().getName())
                .department(staff.getDesignation())
                .month(req.getMonth())
                .year(req.getYear())
                .baseSalary(req.getBaseSalary())
                .bonus(bonus)
                .deductions(deductions)
                .netPay(netPay)
                .bankAccountId(req.getBankAccountId())
                .bankAccountName(bankAccountName)
                .paymentMethod(req.getPaymentMethod())
                .processedBy(actor.getId())
                .build();
        record = recordRepository.save(record);

        // Record DEBIT transaction if a bank account is selected
        if (req.getBankAccountId() != null) {
            BankTransaction txn = BankTransaction.builder()
                    .hospitalId(req.getHospitalId())
                    .bankAccountId(req.getBankAccountId())
                    .amount(netPay)
                    .type("DEBIT")
                    .description("Salary - " + staffName + " (" + monthName(req.getMonth()) + " " + req.getYear() + ")")
                    .referenceNo(req.getReferenceNo())
                    .relatedEntityId(record.getId())
                    .relatedEntityName(staffName)
                    .relatedEntityType("PAYROLL")
                    .createdBy(actor.getId())
                    .build();
            transactionRepository.save(txn);
        }

        return toDTO(record);
    }

    public List<PayrollRecordDTO> getRecords(UUID hospitalId, int month, int year) {
        return recordRepository.findByHospitalIdAndMonthAndYear(hospitalId, month, year)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    private PayrollRecordDTO toDTO(PayrollRecord r) {
        return PayrollRecordDTO.builder()
                .id(r.getId())
                .staffId(r.getStaffId())
                .staffName(r.getStaffName())
                .role(r.getRole())
                .department(r.getDepartment())
                .month(r.getMonth())
                .year(r.getYear())
                .baseSalary(r.getBaseSalary())
                .bonus(r.getBonus())
                .deductions(r.getDeductions())
                .netPay(r.getNetPay())
                .bankAccountId(r.getBankAccountId())
                .bankAccountName(r.getBankAccountName())
                .paymentMethod(r.getPaymentMethod())
                .processedAt(r.getProcessedAt())
                .build();
    }

    private String monthName(int m) {
        return new java.time.Month[]{
            null, java.time.Month.JANUARY, java.time.Month.FEBRUARY, java.time.Month.MARCH,
            java.time.Month.APRIL, java.time.Month.MAY, java.time.Month.JUNE,
            java.time.Month.JULY, java.time.Month.AUGUST, java.time.Month.SEPTEMBER,
            java.time.Month.OCTOBER, java.time.Month.NOVEMBER, java.time.Month.DECEMBER
        }[m].getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH);
    }
}
