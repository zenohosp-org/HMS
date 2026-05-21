package com.zenlocare.HMS_backend.entity;

public enum BedStatus {
    AVAILABLE(1),
    OCCUPIED(2);

    public final int id;

    BedStatus(int id) { this.id = id; }

    public static BedStatus fromId(int id) {
        for (BedStatus s : values()) {
            if (s.id == id) return s;
        }
        throw new IllegalArgumentException("Unknown BedStatus id: " + id);
    }
}
