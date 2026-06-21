package com.zenlocare.HMS_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
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

    /**
     * One row of refund history — a single negative {@code invoice_payment}
     * write, joined with the invoice + patient + bank-account context the
     * finance UI needs to render an actionable audit list.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RefundHistoryRow {
        private UUID paymentId;
        private UUID invoiceId;
        private String invoiceNumber;
        private Integer patientId;
        private String patientName;
        private String uhid;
        /** Positive amount displayed to the user. The underlying invoice_payment row is negative. */
        private BigDecimal amount;
        private String paymentMethod;
        /** True when the refund was cash (no bank-ledger debit posted). */
        private boolean isCash;
        private UUID bankAccountId;
        /** Resolved at read time so the UI doesn't have to round-trip per row. Null for cash. */
        private String bankAccountName;
        /** The user who pressed Issue Refund — copied off the invoice_payment row. */
        private UUID collectedById;
        private String collectedByName;
        private String notes;
        private LocalDateTime refundedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RefundHistoryResponse {
        private List<RefundHistoryRow> refunds;
        /** Sum of {@code amount} values across the returned rows (positive). */
        private BigDecimal totalRefunded;
        /** Echo of the window the caller requested so the UI can label its KPIs. */
        private LocalDate fromDate;
        private LocalDate toDate;
    }
}
