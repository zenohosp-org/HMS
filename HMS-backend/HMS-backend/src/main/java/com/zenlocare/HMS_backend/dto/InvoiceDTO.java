package com.zenlocare.HMS_backend.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class InvoiceDTO {
    private String id;
    private String invoiceNumber;
    private Integer patientId;
    private String patientName;
    private String patientMrn;
    private BigDecimal subtotal;
    private BigDecimal tax;
    private BigDecimal discount;
    private BigDecimal total;
    private String paymentMethod;
    private String notes;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<ItemDTO> items;

    @Data
    @Builder
    public static class ItemDTO {
        private String itemType;
        private String description;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal totalPrice;
        private UUID serviceId;
    }
}
