package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.dto.InvoiceDTO;
import com.zenlocare.HMS_backend.dto.InvoiceRequest;
import com.zenlocare.HMS_backend.dto.SmartBillingSuggestion;
import com.zenlocare.HMS_backend.entity.Invoice;
import com.zenlocare.HMS_backend.service.InvoiceService;
import com.zenlocare.HMS_backend.service.SmartBillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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

    @GetMapping("/admissions/{admissionId}/invoice")
    public ResponseEntity<InvoiceDTO> getAdmissionInvoice(@PathVariable UUID admissionId) {
        return invoiceService.getAdmissionInvoice(admissionId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PutMapping("/invoices/{id}/finalize")
    public ResponseEntity<InvoiceDTO> finalizeIPDInvoice(@PathVariable UUID id, @RequestBody InvoiceRequest req) {
        try {
            return ResponseEntity.ok(invoiceService.finalizeIPDInvoice(id, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/invoices/{id}/detail")
    public ResponseEntity<InvoiceDTO> getInvoiceDetail(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(invoiceService.getInvoiceDetail(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/invoices/{invoiceId}/items/{itemId}/waive")
    public ResponseEntity<InvoiceDTO> waiveItem(
            @PathVariable UUID invoiceId,
            @PathVariable UUID itemId,
            @RequestBody Map<String, Object> body) {
        BigDecimal amount = new BigDecimal(body.getOrDefault("waiverAmount", "0").toString());
        String reason = (String) body.getOrDefault("waiverReason", "");
        try {
            return ResponseEntity.ok(invoiceService.applyWaiver(invoiceId, itemId, amount, reason));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
