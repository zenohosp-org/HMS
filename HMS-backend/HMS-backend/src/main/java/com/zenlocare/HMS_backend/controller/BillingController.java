package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.SmartBillingSuggestion;
import com.zenlocare.HMS_backend.entity.Invoice;
import com.zenlocare.HMS_backend.service.InvoiceService;
import com.zenlocare.HMS_backend.service.SmartBillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/billing")
@RequiredArgsConstructor
public class BillingController {

    private final SmartBillingService smartBillingService;
    private final InvoiceService invoiceService;

    @GetMapping("/smart-suggestions")
    public ResponseEntity<SmartBillingSuggestion> getSuggestions(@RequestParam Integer patientId) {
        return ResponseEntity.ok(smartBillingService.getSuggestions(patientId));
    }

    @GetMapping("/patient/{patientId}/invoices")
    public ResponseEntity<List<Invoice>> getPatientInvoices(@PathVariable Integer patientId) {
        return ResponseEntity.ok(invoiceService.getPatientInvoices(patientId));
    }
}
