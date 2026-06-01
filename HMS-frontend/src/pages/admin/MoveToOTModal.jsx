import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { admissionApi, roomApi, doctorsApi } from "@/utils/api";
import { Scissors, BedDouble, Stethoscope, Loader2 } from "lucide-react";
import {
    Button,
    FormGroup,
    Modal,
} from "@/components/ui";
import SearchableSelect from "@/components/ui/SearchableSelect";

/**
 * Move-to-OT modal. Lists OT rooms with status AVAILABLE and the
 * active doctor roster. Caller (Admissions list) owns the admission;
 * onMoved() runs after a successful admissionApi.moveToOT call.
 *
 * Phase 8c migration: same data layer, same validation (must pick a
 * room), same notify copy. The OT room picker stays as styled radio
 * buttons since the option count is small and visual previews matter.
 */
export default function MoveToOTModal({ admission, onClose, onMoved }) {
    const { user } = useAuth();
    const { notify } = useNotification();

    const [otRooms, setOtRooms] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState("");
    const [selectedDoctorId, setSelectedDoctorId] = useState(
        admission.admittingDoctorId || ""
    );

    useEffect(() => {
        if (!user?.hospitalId) return;
        Promise.all([roomApi.list(user.hospitalId), doctorsApi.list(user.hospitalId)])
            .then(([rooms, docs]) => {
                setOtRooms(
                    rooms.filter((r) => r.roomType === "OT" && r.status === "AVAILABLE")
                );
                setDoctors(docs.filter((d) => d.userIsActive));
            })
            .catch(() => {
                notify("Failed to load OT rooms or doctors", "error");
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.hospitalId]);

    const handleSubmit = async () => {
        if (!selectedRoomId) {
            notify("Please select an OT room", "warning");
            return;
        }
        setSubmitting(true);
        try {
            await admissionApi.moveToOT(
                admission.id,
                Number(selectedRoomId),
                selectedDoctorId || null
            );
            notify(`${admission.patientName} moved to OT successfully`, "success");
            onMoved();
        } catch (err) {
            notify(err?.response?.data?.message || "Failed to move patient to OT", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="md"
            title={
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: "var(--hms-gray-100)",
                            color: "var(--hms-gray-700)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Scissors size={16} />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--hms-gray-900)" }}>
                            Move to OT
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: "var(--hms-gray-500)" }}>
                            {admission.patientName}
                        </p>
                    </div>
                </div>
            }
            footer={
                <>
                    <Button variant="cancel" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={loading || !selectedRoomId}
                        loading={submitting}
                    >
                        Move to OT
                    </Button>
                </>
            }
        >
            {loading ? (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: 32,
                        color: "var(--hms-gray-400)",
                    }}
                >
                    <Loader2 size={16} className="animate-spin" />
                    <span style={{ fontSize: 13 }}>Loading OT rooms…</span>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <FormGroup
                        label={
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <BedDouble size={14} /> Select OT room
                            </span>
                        }
                    >
                        {otRooms.length === 0 ? (
                            <div
                                style={{
                                    padding: "12px 16px",
                                    borderRadius: 8,
                                    border: "1px solid var(--hms-warning-border)",
                                    background: "var(--hms-warning-bg)",
                                    color: "#92400e",
                                    fontSize: 13,
                                }}
                            >
                                No OT rooms available. Add OT rooms in Settings → Infrastructure.
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {otRooms.map((room) => {
                                    const selected = selectedRoomId === String(room.id);
                                    return (
                                        <label
                                            key={room.id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                                padding: "12px 16px",
                                                borderRadius: 8,
                                                border: `1px solid ${selected
                                                    ? "var(--hms-brand-primary)"
                                                    : "var(--hms-gray-200)"
                                                    }`,
                                                background: selected
                                                    ? "var(--hms-gray-50)"
                                                    : "var(--hms-white)",
                                                cursor: "pointer",
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="otRoom"
                                                value={room.id}
                                                checked={selected}
                                                onChange={(e) => setSelectedRoomId(e.target.value)}
                                                style={{
                                                    accentColor: "var(--hms-brand-primary)",
                                                    cursor: "pointer",
                                                }}
                                            />
                                            <div>
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        color: "var(--hms-gray-800)",
                                                    }}
                                                >
                                                    {room.roomNumber}
                                                </p>
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 11,
                                                        color: "var(--hms-gray-500)",
                                                    }}
                                                >
                                                    OT · Available
                                                </p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </FormGroup>

                    <FormGroup
                        label={
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Stethoscope size={14} /> Performing doctor
                            </span>
                        }
                    >
                        <SearchableSelect
                            value={selectedDoctorId}
                            onChange={(v) => setSelectedDoctorId(v)}
                            options={doctors.map((d) => ({
                                value: d.id,
                                label: `Dr. ${d.firstName} ${d.lastName}${d.specialization ? ` · ${d.specialization}` : ""
                                    }`,
                            }))}
                            placeholder="— Keep current doctor —"
                        />
                    </FormGroup>
                </div>
            )}
        </Modal>
    );
}
