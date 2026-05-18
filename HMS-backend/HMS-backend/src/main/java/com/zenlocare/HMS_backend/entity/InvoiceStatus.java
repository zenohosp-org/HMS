package com.zenlocare.HMS_backend.entity;

public enum InvoiceStatus {
    UNPAID,
    PARTIAL,    // OPD: part of balance collected; remainder outstanding
    PAID,
    CANCELLED,
    SETTLED,    // IPD: bill fully cleared
    UNSETTLED   // IPD: balance outstanding (replaces UNPAID/PARTIAL for admissions)
}
