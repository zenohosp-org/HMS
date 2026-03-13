package com.zenlocare.HMS_backend.controller;

import com.zenlocare.HMS_backend.entity.Invoice;
import com.zenlocare.HMS_backend.service.InvoiceService;
import com.zenlocare.HMS_backend.dto.InvoiceRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class InvoiceController {

    private final InvoiceService invoiceService;

    @PostMapping
    public ResponseEntity<Invoice> createInvoice(@RequestBody com.zenlocare.HMS_backend.dto.InvoiceRequest request) {
        return ResponseEntity.ok(invoiceService.createInvoice(request));
    }

    @GetMapping("/hospital/{hospitalId}")
    public ResponseEntity<List<Invoice>> getHospitalInvoices(@PathVariable UUID hospitalId) {
        return ResponseEntity.ok(invoiceService.getHospitalInvoices(hospitalId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Invoice> getInvoice(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(invoiceService.getInvoice(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
