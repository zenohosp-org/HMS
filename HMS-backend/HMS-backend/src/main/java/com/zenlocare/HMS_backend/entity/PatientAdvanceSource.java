package com.zenlocare.HMS_backend.entity;

public enum PatientAdvanceSource {
    REGISTRATION, // Collected at patient registration desk
    ADMISSION,    // Collected at IPD room admission (asset/room security)
    TOPUP         // Additional top-up collected during the stay
}
