import { useMemo, useState } from "react";
import { useFeatureFlags } from "@/context/FeatureFlagsContext";
import { useNotification } from "@/context/NotificationContext";
import {
    Ambulance,
    ScanLine,
    HeartPulse,
    BedDouble,
    Loader2,
    Settings as SettingsIcon,
} from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";

const FEATURE_META = {
    AMBULANCE: {
        label: "Ambulance",
        description: "Show ambulance booking, status and billing in the sidebar.",
        icon: Ambulance,
    },
    RADIOLOGY: {
        label: "Radiology",
        description: "Show the imaging queue and radiology reports module.",
        icon: ScanLine,
    },
    HEALTH_CHECKUPS: {
        label: "Health checkups",
        description: "Show packaged health-checkup bookings in the sidebar.",
        icon: HeartPulse,
    },
    IPD: {
        label: "IPD management",
        description: "Show room allocation, room logs and IPD admissions.",
        icon: BedDouble,
    },
};

/** Switch — design-system styled toggle for feature flags. */
function ToggleSwitch({ checked, onChange, disabled }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            style={{
                position: "relative",
                display: "inline-flex",
                width: 44,
                height: 24,
                flexShrink: 0,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                borderRadius: 999,
                border: "2px solid transparent",
                background: checked ? "var(--hms-success)" : "var(--hms-gray-300)",
                transition: "background 0.2s",
                padding: 0,
                fontFamily: "var(--hms-font-family)",
            }}
        >
            <span
                style={{
                    pointerEvents: "none",
                    display: "inline-block",
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: "var(--hms-white)",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                    transform: `translateX(${checked ? 20 : 0}px)`,
                    transition: "transform 0.2s",
                }}
            />
        </button>
    );
}

/**
 * General settings — per-hospital feature flags. Toggling a row hides
 * the corresponding module from the sidebar; data and API endpoints
 * remain available even when disabled.
 *
 * Phase 9 migration: data layer unchanged (useFeatureFlags context),
 * same per-row spinner during in-flight setFlag, same notify copy.
 */
export default function GeneralSettings() {
    const { flags, supported, loading, setFlag } = useFeatureFlags();
    const { notify } = useNotification();
    const [savingKey, setSavingKey] = useState(null);

    const rows = useMemo(() => {
        return (supported.length ? supported : Object.keys(FEATURE_META)).map((key) => ({
            key,
            meta: FEATURE_META[key] ?? {
                label: key,
                description: "",
                icon: SettingsIcon,
            },
            enabled: flags[key] !== false,
        }));
    }, [supported, flags]);

    const handleToggle = async (key, next) => {
        setSavingKey(key);
        try {
            await setFlag(key, next);
            notify(
                `${FEATURE_META[key]?.label ?? key} ${next ? "enabled" : "disabled"}`,
                "success"
            );
        } catch {
            notify("Failed to update setting", "error");
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PageHeader
                title="General settings"
                subtitle="Enable or disable modules across the hospital. Disabling a module only hides it from the sidebar — existing data and API endpoints remain available."
            />

            <div style={{ padding: "0 24px 24px" }}>
                <Card style={{ padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <div
                            style={{
                                padding: "80px 0",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            <Loader2
                                size={32}
                                style={{ color: "var(--hms-gray-700)" }}
                                className="animate-spin"
                            />
                            <p style={{ margin: 0, fontSize: 13, color: "var(--hms-gray-500)" }}>
                                Loading settings…
                            </p>
                        </div>
                    ) : (
                        <ul
                            style={{
                                margin: 0,
                                padding: 0,
                                listStyle: "none",
                            }}
                        >
                            {rows.map(({ key, meta, enabled }, idx) => {
                                const Icon = meta.icon;
                                const isSaving = savingKey === key;
                                return (
                                    <li
                                        key={key}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 24,
                                            padding: "20px 24px",
                                            borderTop:
                                                idx === 0 ? "none" : "1px solid var(--hms-gray-100)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "flex-start",
                                                gap: 16,
                                                minWidth: 0,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 8,
                                                    background: "var(--hms-gray-100)",
                                                    color: "var(--hms-gray-600)",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Icon size={20} />
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <p
                                                        style={{
                                                            margin: 0,
                                                            fontWeight: 600,
                                                            fontSize: 15,
                                                            color: "var(--hms-gray-900)",
                                                        }}
                                                    >
                                                        {meta.label}
                                                    </p>
                                                    <Badge tone={enabled ? "success" : "neutral"} soft>
                                                        {enabled ? "Enabled" : "Disabled"}
                                                    </Badge>
                                                </div>
                                                {meta.description && (
                                                    <p
                                                        style={{
                                                            margin: "4px 0 0",
                                                            fontSize: 13,
                                                            color: "var(--hms-gray-500)",
                                                        }}
                                                    >
                                                        {meta.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {isSaving && (
                                                <Loader2
                                                    size={16}
                                                    style={{ color: "var(--hms-gray-400)" }}
                                                    className="animate-spin"
                                                />
                                            )}
                                            <ToggleSwitch
                                                checked={enabled}
                                                onChange={(next) => handleToggle(key, next)}
                                                disabled={isSaving}
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
}
