package com.zenlocare.HMS_backend.entity;

public enum InvoiceStatus {
    UNPAID,
    PARTIAL,   // Part of balance collected; remainder outstanding
    PAID,
    CANCELLED
}
