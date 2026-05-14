package com.zenlocare.HMS_backend.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Collections;

@Data
@Builder
public class InvoiceDTO {
    private String id;
    private String invoiceNumber;
    private Integer patientId;
    private String patientName;
    private String patientMrn;
    private UUID admissionId;
    private String admissionNumber;
    private BigDecimal subtotal;
    private BigDecimal tax;
    private BigDecimal discount;
    private BigDecimal total;
    private String paymentMethod;
    private String notes;
    private String status;
    private BigDecimal advanceAdjusted;
    private BigDecimal paidAmount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<ItemDTO> items;
    private List<PaymentDTO> payments;

    @Data
    @Builder
    public static class PaymentDTO {
        private UUID id;
        private BigDecimal amount;
        private String paymentMethod;
        private String collectedBy;
        private LocalDateTime paidAt;
    }

    @Data
    @Builder
    public static class ItemDTO {
        private UUID id;
        private String itemType;
        private String description;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal totalPrice;
        private BigDecimal waiverAmount;
        private String waiverReason;
        private UUID serviceId;
        private Long radiologyOrderId;
        private UUID appointmentId;
    }
}
