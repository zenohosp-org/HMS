package com.zenlocare.HMS_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Wire DTOs for finance-issued refunds. Kept in one file for the same reason as
 * {@link PrescriptionReturnDtos} — small shapes that all serve a single feature.
 */
public final class RefundDtos {

    private RefundDtos() {}

    /** POST body for the refund endpoint. */
    @Data
    public static class IssueRefundRequest {
        /** Idempotency token; client-generated UUID. Required. */
        private UUID clientRequestId;
        /** Positive amount to refund. Must be ≤ (paid_amount − total). */
        private BigDecimal amount;
        /** "Cash" / "UPI" / "Card" / "Bank Transfer" etc. Required. */
        private String paymentMethod;
        /** Required for non-cash refunds. */
        private UUID bankAccountId;
        /** Free-text — appears on the negative payment row. Optional. */
        private String notes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IssueRefundResponse {
        private UUID paymentId;
        private UUID invoiceId;
        private String invoiceNumber;
        private BigDecimal refundedAmount;   // positive amount that was refunded
        private BigDecimal newPaidAmount;    // invoice.paidAmount after refund
        private BigDecimal newRefundable;    // remaining overpayment (0 when fully refunded)
        private LocalDateTime refundedAt;
    }

    /** One row of the Pending Refunds list. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PendingRefundDto {
        private UUID invoiceId;
        private String invoiceNumber;
        private Integer patientId;
        private String patientName;
        private String uhid;
        private UUID admissionId;
        private UUID appointmentId;
        private BigDecimal billedTotal;     // invoice.total (net of credit notes)
        private BigDecimal paidAmount;      // invoice.paidAmount (net of refunds)
        private BigDecimal refundableAmount; // paidAmount − billedTotal
        private LocalDateTime lastUpdated;
    }

    /** Wrapper so the list response can grow KPI fields later without breaking clients. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PendingRefundsResponse {
        private List<PendingRefundDto> invoices;
        private BigDecimal totalRefundable;
    }
}
