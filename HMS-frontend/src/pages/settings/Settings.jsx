import { useState } from "react";
import { Network, Settings as SettingsIcon } from "lucide-react";
import InfrastructureMapping from "@/pages/ipd/InfrastructureMapping";

const TABS = [
  { key: "infrastructure", label: "Infrastructure", icon: Network },
];

export default function Settings() {
  const [tab, setTab] = useState("infrastructure");

  return (
    <div className="flex h-full bg-slate-50 dark:bg-[#050505]">
      {/* Left tab rail */}
      <aside className="w-52 shrink-0 border-r border-slate-200 dark:border-[#222222] bg-white dark:bg-[#111111] flex flex-col pt-6">
        <div className="px-5 mb-5">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-slate-400" />
            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Settings</h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-[#999999] mt-1">Hospital configuration</p>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-left ${
                  tab === t.key
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "text-slate-600 dark:text-[#888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === "infrastructure" && <InfrastructureMapping />}
      </div>
    </div>
  );
}
