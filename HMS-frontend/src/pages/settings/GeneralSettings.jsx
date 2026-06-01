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
    label: "Health Checkups",
    description: "Show packaged health-checkup bookings in the sidebar.",
    icon: HeartPulse,
  },
  IPD: {
    label: "IPD Management",
    description: "Show room allocation, room logs and IPD admissions.",
    icon: BedDouble,
  },
};

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/50 disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-[#2a2a2a]"}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
          ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

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
      notify(`${FEATURE_META[key]?.label ?? key} ${next ? "enabled" : "disabled"}`, "success");
    } catch {
      notify("Failed to update setting", "error");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#050505] gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            General Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enable or disable modules across the hospital. Disabling a module
            only hides it from the sidebar — existing data and API endpoints
            remain available.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111111] rounded-lg border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Loading settings…
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#1a1a1a]">
            {rows.map(({ key, meta, enabled }) => {
              const Icon = meta.icon;
              const isSaving = savingKey === key;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-6 px-6 py-5"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[15px] text-slate-900 dark:text-white">
                          {meta.label}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            enabled
                              ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30"
                              : "bg-slate-50 dark:bg-slate-900/10 text-slate-500 dark:text-slate-500 border-slate-100 dark:border-slate-800/30"
                          }`}
                        >
                          {enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      {meta.description && (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {meta.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isSaving && (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
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
      </div>
    </div>
  );
}
