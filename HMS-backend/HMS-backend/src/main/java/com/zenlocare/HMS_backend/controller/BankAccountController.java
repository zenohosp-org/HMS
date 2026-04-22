package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.BankAccountDTO;
import com.zenlocare.HMS_backend.service.BankAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/bank-accounts")
@RequiredArgsConstructor
public class BankAccountController {

    private final BankAccountService bankAccountService;

    @GetMapping
    public ResponseEntity<List<BankAccountDTO>> list(@RequestParam UUID hospitalId) {
        return ResponseEntity.ok(bankAccountService.listByHospital(hospitalId));
    }
}
