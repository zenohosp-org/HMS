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
    private List<InvoiceItemRequest> items;

    @Data
    public static class InvoiceItemRequest {
        private UUID serviceId;
        private String itemType;
        private String description;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal totalPrice;
    }
}
