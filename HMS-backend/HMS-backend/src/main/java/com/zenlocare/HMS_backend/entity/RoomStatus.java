package com.zenlocare.HMS_backend.entity;

public enum RoomStatus {
    AVAILABLE(1),
    OCCUPIED(2),
    MAINTENANCE(3);

    public final int id;

    RoomStatus(int id) { this.id = id; }

    public static RoomStatus fromId(int id) {
        for (RoomStatus s : values()) {
            if (s.id == id) return s;
        }
        throw new IllegalArgumentException("Unknown RoomStatus id: " + id);
    }
}
