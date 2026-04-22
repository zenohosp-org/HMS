package com.zenlocare.HMS_backend.repository;

import com.zenlocare.HMS_backend.entity.BankAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface BankAccountRepository extends JpaRepository<BankAccount, UUID> {
    List<BankAccount> findByHospitalId(UUID hospitalId);
}
