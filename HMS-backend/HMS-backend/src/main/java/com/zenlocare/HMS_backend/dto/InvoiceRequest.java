package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.InvoiceStatus;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
public class InvoiceRequest {
    private String invoiceNumber;
    private UUID hospitalId;
    private Integer patientId;
    private UUID admissionId;
    private UUID appointmentId;
    private UUID specializationId;
    private BigDecimal subtotal;
    private BigDecimal tax;
    private BigDecimal discount;
    private BigDecimal total;
    private String notes;
    private String paymentMethod;
    private UUID bankAccountId;
    private InvoiceStatus status;
    private java.math.BigDecimal advanceAdjusted; // total advance deducted at finalization
    private List<InvoiceItemRequest> items;

    @Data
    public static class InvoiceItemRequest {
        private UUID serviceId;
        private Long radiologyOrderId;
        private UUID appointmentId;
        private Long ambulanceBookingId;
        // pharmacy_bills.id from api-pharmacy. Sent only on MEDICINE rows
        // pulled from the pharmacy service; HMS persists it so subsequent
        // reloads of the finalize modal can skip already-invoiced bills.
        private UUID pharmacyBillId;
        private String itemType;
        private String description;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal totalPrice;
    }
}
