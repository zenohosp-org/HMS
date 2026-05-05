package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.InvoiceDTO;
import com.zenlocare.HMS_backend.dto.SmartBillingSuggestion;
import com.zenlocare.HMS_backend.entity.Invoice;
import com.zenlocare.HMS_backend.service.InvoiceService;
import com.zenlocare.HMS_backend.service.SmartBillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/billing")
@RequiredArgsConstructor
public class BillingController {

    private final SmartBillingService smartBillingService;
    private final InvoiceService invoiceService;

    @GetMapping("/smart-suggestions")
    public ResponseEntity<SmartBillingSuggestion> getSuggestions(
            @RequestParam Integer patientId,
            @RequestParam(required = false) UUID admissionId) {
        return ResponseEntity.ok(smartBillingService.getSuggestions(patientId, admissionId));
    }

    @GetMapping("/patient/{patientId}/invoices")
    public ResponseEntity<List<InvoiceDTO>> getPatientInvoices(@PathVariable Integer patientId) {
        return ResponseEntity.ok(invoiceService.getPatientInvoices(patientId));
    }

    @PatchMapping("/invoices/{id}/pay")
    public ResponseEntity<Invoice> markAsPaid(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> body) {
        UUID bankAccountId = (body != null && body.get("bankAccountId") != null)
                ? UUID.fromString(body.get("bankAccountId")) : null;
        return ResponseEntity.ok(invoiceService.markAsPaid(id, bankAccountId));
    }
}
