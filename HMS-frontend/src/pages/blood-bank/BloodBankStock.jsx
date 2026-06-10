import { useEffect, useMemo, useState } from "react";
import { Droplet, Plus, MoreHorizontal, AlertTriangle, RefreshCw, FlaskConical, History, Activity, Calendar, CalendarDays } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { bloodBankApi } from "@/utils/api";
import {
  Badge,
  Button,
  Menu,
  PageHeader,
  SearchBar,
  Table,
} from "@/components/ui";
import SearchableSelect from "@/components/ui/SearchableSelect";
import RegisterBloodUnitModal from "@/components/modals/RegisterBloodUnitModal";
import IssueBloodUnitModal from "@/components/modals/IssueBloodUnitModal";

function tonePillClass(meta) {
  if (!meta) return "hms-bb-status is-neutral";
  try {
    const m = typeof meta === "string" ? JSON.parse(meta) : meta;
    return `hms-bb-status is-${m.tone || "neutral"}`;
  } catch {
    return "hms-bb-status is-neutral";
  }
}

/**
 * Blood Bank — two-view dashboard split by the zu-pill-group pattern
 * used on IPD Billing.
 *
 *   • Stock view     — inventory health: stat strip + group × component
 *                      matrix + filterable table of non-issued bags.
 *                      Primary action: Register bag.
 *   • Issue Blood    — issuance audit: time-based stat strip + history
 *                      table of ISSUED bags with patient / admission /
 *                      doctor columns. Read-only audit surface — actual
 *                      issuance is triggered from the Stock view's row
 *                      action menu (matches the billing tabs' pattern of
 *                      "this view is a lens, not a different workflow").
 */
export default function BloodBankStock() {
  const { user } = useAuth();
  const { notify } = useNotification();

  const [tab, setTab] = useState("stock"); // "stock" | "issue"

  const [stats, setStats] = useState(null);
  const [units, setUnits] = useState([]);
  const [groups, setGroups] = useState([]);
  const [components, setComponents] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [componentFilter, setComponentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [registerOpen, setRegisterOpen] = useState(false);
  const [issueUnit, setIssueUnit] = useState(null);

  const hospitalId = user?.hospitalId;

  const reload = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const [s, u, g, c, st] = await Promise.all([
        bloodBankApi.getStats(hospitalId),
        bloodBankApi.listUnits(hospitalId, {
          groupCode: groupFilter || undefined,
          componentCode: componentFilter || undefined,
          statusCode: statusFilter || undefined,
        }),
        bloodBankApi.listLookups(hospitalId, "BLOOD_GROUP").catch(() => []),
        bloodBankApi.listLookups(hospitalId, "COMPONENT").catch(() => []),
        bloodBankApi.listLookups(hospitalId, "UNIT_STATUS").catch(() => []),
      ]);
      setStats(s);
      setUnits(u);
      setGroups(g);
      setComponents(c);
      setStatuses(st);
    } catch {
      notify("Failed to load blood bank data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId, groupFilter, componentFilter, statusFilter]);

  // Reset filters when switching tabs — each view has its own focus.
  useEffect(() => {
    setSearch("");
    setGroupFilter("");
    setComponentFilter("");
    setStatusFilter("");
  }, [tab]);

  const statusByCode = useMemo(() => {
    const m = {};
    statuses.forEach((s) => { m[s.code] = s; });
    return m;
  }, [statuses]);

  // ── Per-tab unit subset ──────────────────────────────────────────────
  // Stock view hides ISSUED bags by default (history belongs on the
  // Issue tab); Issue view only shows ISSUED bags.
  const visibleUnits = useMemo(() => {
    if (tab === "issue") return units.filter((u) => u.statusCode === "ISSUED");
    return units.filter((u) => u.statusCode !== "ISSUED");
  }, [units, tab]);

  const filteredUnits = useMemo(() => {
    if (!search) return visibleUnits;
    const q = search.toLowerCase();
    return visibleUnits.filter(
      (u) =>
        u.bagNumber?.toLowerCase().includes(q) ||
        u.bloodGroupCode?.toLowerCase().includes(q) ||
        u.componentCode?.toLowerCase().includes(q) ||
        u.donorName?.toLowerCase().includes(q) ||
        u.issuedToPatientName?.toLowerCase().includes(q) ||
        u.issuedToAdmissionNumber?.toLowerCase().includes(q) ||
        u.issuedDoctorName?.toLowerCase().includes(q)
    );
  }, [visibleUnits, search]);

  // ── Issue-tab time-based metrics ─────────────────────────────────────
  const issuanceMetrics = useMemo(() => {
    const issued = units.filter((u) => u.statusCode === "ISSUED" && u.issuedAt);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let today = 0, week = 0, month = 0;
    issued.forEach((u) => {
      const t = new Date(u.issuedAt);
      if (t >= startOfToday) today += 1;
      if (t >= startOfWeek) week += 1;
      if (t >= startOfMonth) month += 1;
    });
    return { today, week, month, total: issued.length };
  }, [units]);

  const handleStatusChange = async (unit, newStatus) => {
    try {
      await bloodBankApi.updateStatus(unit.id, newStatus);
      notify(`Marked as ${newStatus.toLowerCase()}`, "success");
      reload();
    } catch {
      notify("Failed to update status", "error");
    }
  };

  // ── Column sets — each view picks its own ────────────────────────────
  const stockColumns = [
    {
      header: "Bag",
      width: "18%",
      render: (u) => (
        <div>
          <div className="font-semibold text-gray-900">{u.bagNumber}</div>
          <div className="text-xs text-gray-500">{u.storageLocation || "—"}</div>
        </div>
      ),
    },
    {
      header: "Group / Component",
      width: "22%",
      render: (u) => (
        <div className="flex items-center gap-2">
          <span className="hms-bb-group">{u.bloodGroupCode?.replace("_POS", "+").replace("_NEG", "−")}</span>
          <span className="text-sm text-gray-700">{u.componentCode}</span>
        </div>
      ),
    },
    {
      header: "Status",
      width: "12%",
      render: (u) => {
        const s = statusByCode[u.statusCode];
        return <span className={tonePillClass(s?.metadata)}>{s?.label || u.statusCode}</span>;
      },
    },
    {
      header: "Expiry",
      width: "12%",
      render: (u) => (
        <span className={u.expiringSoon ? "hms-bb-expiry" : "text-gray-700"}>
          {u.expiryDate || "—"}
        </span>
      ),
    },
    {
      header: "Donor / Source",
      width: "24%",
      render: (u) => (
        <div className="text-sm">
          <div className="text-gray-900">{u.donorName || (u.sourceCode === "EXTERNAL_PURCHASE" ? "External" : "—")}</div>
          <div className="text-xs text-gray-500">{u.donorPhone || ""}</div>
        </div>
      ),
    },
    {
      header: "",
      width: "6%",
      align: "right",
      render: (u) => {
        const items = [];
        if (u.statusCode === "AVAILABLE" || u.statusCode === "RESERVED") {
          items.push({ label: "Issue to patient", onClick: () => setIssueUnit(u) });
        }
        if (u.statusCode === "QUARANTINE") {
          items.push({ label: "Mark AVAILABLE", onClick: () => handleStatusChange(u, "AVAILABLE") });
          items.push({ label: "Mark DISCARDED", onClick: () => handleStatusChange(u, "DISCARDED"), tone: "danger" });
        }
        if (u.statusCode === "AVAILABLE") {
          items.push({ label: "Reserve", onClick: () => handleStatusChange(u, "RESERVED") });
          items.push({ divider: true });
          items.push({ label: "Mark EXPIRED", onClick: () => handleStatusChange(u, "EXPIRED"), tone: "danger" });
          items.push({ label: "Discard", onClick: () => handleStatusChange(u, "DISCARDED"), tone: "danger" });
        }
        if (u.statusCode === "RESERVED") {
          items.push({ label: "Release (back to AVAILABLE)", onClick: () => handleStatusChange(u, "AVAILABLE") });
        }
        if (items.length === 0) {
          items.push({ label: "No actions available", disabled: true });
        }
        return (
          <Menu
            triggerIcon={<MoreHorizontal size={18} />}
            triggerLabel="Row actions"
            align="right"
            items={items}
          />
        );
      },
    },
  ];

  const issueColumns = [
    {
      header: "Bag",
      width: "14%",
      render: (u) => (
        <div className="font-semibold text-gray-900">{u.bagNumber}</div>
      ),
    },
    {
      header: "Group / Component",
      width: "16%",
      render: (u) => (
        <div className="flex items-center gap-2">
          <span className="hms-bb-group">{u.bloodGroupCode?.replace("_POS", "+").replace("_NEG", "−")}</span>
          <span className="text-sm text-gray-700">{u.componentCode}</span>
        </div>
      ),
    },
    {
      header: "Patient",
      width: "20%",
      render: (u) => (
        <div className="text-sm">
          <div className="text-gray-900">{u.issuedToPatientName || "—"}</div>
          {u.issuedToAdmissionNumber && (
            <div className="text-xs text-gray-500">Adm. {u.issuedToAdmissionNumber}</div>
          )}
        </div>
      ),
    },
    {
      header: "Prescribing doctor",
      width: "15%",
      render: (u) => (
        <span className="text-sm text-gray-700">{u.issuedDoctorName || "—"}</span>
      ),
    },
    {
      header: "Issued",
      width: "13%",
      render: (u) => (
        <span className="text-sm text-gray-700">
          {u.issuedAt ? u.issuedAt.slice(0, 16).replace("T", " ") : "—"}
        </span>
      ),
    },
    {
      header: "Replacements",
      width: "10%",
      align: "right",
      render: (u) => (
        <span className="text-sm text-gray-700 tabular-nums">
          {(u.replacementsReceived ?? 0)} / {(u.replacementsPledged ?? 0)}
        </span>
      ),
    },
    {
      header: "Issued by",
      width: "12%",
      render: (u) => (
        <span className="text-sm text-gray-700">{u.issuedByUserName || "—"}</span>
      ),
    },
  ];

  const groupOrder = groups.map((g) => g.code);
  const componentOrder = components.map((c) => c.code);

  const renderMatrix = () => {
    if (!stats?.stockMatrix) return null;
    const matrix = stats.stockMatrix;
    return (
      <div className="hms-bb-matrix">
        <div className="hms-bb-matrix__head">
          <div>
            <div className="hms-bb-matrix__title">Available stock by group × component</div>
            <div className="hms-bb-matrix__sub">Only AVAILABLE bags. Click a cell to filter the table.</div>
          </div>
          <Button variant="ghost" onClick={reload}><RefreshCw size={14} /> Refresh</Button>
        </div>
        <div className="hms-bb-matrix__grid">
          <table className="hms-bb-matrix__table">
            <thead>
              <tr>
                <th>Group</th>
                {componentOrder.map((c) => (
                  <th key={c}>{c.replace(/_/g, " ")}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {groupOrder.map((g) => {
                const row = matrix[g] || {};
                const total = Object.values(row).reduce((a, b) => a + b, 0);
                return (
                  <tr key={g}>
                    <td><span className="hms-bb-group">{g.replace("_POS", "+").replace("_NEG", "−")}</span></td>
                    {componentOrder.map((c) => {
                      const count = row[c] || 0;
                      return (
                        <td key={c} className={`hms-bb-matrix__cell ${count ? "is-stocked" : "is-zero"}`}>
                          <button
                            type="button"
                            onClick={() => { setGroupFilter(g); setComponentFilter(c); setStatusFilter("AVAILABLE"); }}
                            className="bg-transparent border-0 cursor-pointer text-inherit p-0"
                          >
                            {count}
                          </button>
                        </td>
                      );
                    })}
                    <td className={`hms-bb-matrix__cell ${total ? "is-stocked" : "is-zero"}`}>{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Stat strips — different per view ─────────────────────────────────
  const renderStockStats = () => (
    <div className="hms-bb-stats">
      <div className="hms-bb-stat">
        <div className="hms-bb-stat__label">Total units</div>
        <div className="hms-bb-stat__value">{stats?.totalUnits ?? "—"}</div>
        <div className="hms-bb-stat__hint">Across all statuses</div>
      </div>
      <div className="hms-bb-stat">
        <div className="hms-bb-stat__label">Available</div>
        <div className="hms-bb-stat__value">{stats?.availableUnits ?? "—"}</div>
        <div className="hms-bb-stat__hint">Ready to issue</div>
      </div>
      <div className="hms-bb-stat">
        <div className="hms-bb-stat__label">Quarantine</div>
        <div className="hms-bb-stat__value">{stats?.quarantineUnits ?? "—"}</div>
        <div className="hms-bb-stat__hint">Awaiting TTI clearance</div>
      </div>
      <div className="hms-bb-stat">
        <div className="hms-bb-stat__label">Reserved</div>
        <div className="hms-bb-stat__value">{stats?.reservedUnits ?? "—"}</div>
        <div className="hms-bb-stat__hint">Tagged for patients</div>
      </div>
      <div className="hms-bb-stat is-warn">
        <div className="hms-bb-stat__label">
          <span className="inline-flex items-center gap-1">
            <AlertTriangle size={12} /> Expiring soon
          </span>
        </div>
        <div className="hms-bb-stat__value">{stats?.expiringSoonUnits ?? "—"}</div>
        <div className="hms-bb-stat__hint">Within 7 days</div>
      </div>
      <div className="hms-bb-stat">
        <div className="hms-bb-stat__label">
          <span className="inline-flex items-center gap-1">
            <FlaskConical size={12} /> Donors
          </span>
        </div>
        <div className="hms-bb-stat__value">{stats?.totalDonors ?? "—"}</div>
        <div className="hms-bb-stat__hint">Active registry</div>
      </div>
    </div>
  );

  const renderIssueStats = () => (
    <div className="hms-bb-stats">
      <div className="hms-bb-stat">
        <div className="hms-bb-stat__label">
          <span className="inline-flex items-center gap-1">
            <Activity size={12} /> Today
          </span>
        </div>
        <div className="hms-bb-stat__value">{issuanceMetrics.today}</div>
        <div className="hms-bb-stat__hint">Bags issued</div>
      </div>
      <div className="hms-bb-stat">
        <div className="hms-bb-stat__label">
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} /> This week
          </span>
        </div>
        <div className="hms-bb-stat__value">{issuanceMetrics.week}</div>
        <div className="hms-bb-stat__hint">Since Sunday</div>
      </div>
      <div className="hms-bb-stat">
        <div className="hms-bb-stat__label">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} /> This month
          </span>
        </div>
        <div className="hms-bb-stat__value">{issuanceMetrics.month}</div>
        <div className="hms-bb-stat__hint">Month-to-date</div>
      </div>
      <div className="hms-bb-stat">
        <div className="hms-bb-stat__label">
          <span className="inline-flex items-center gap-1">
            <History size={12} /> All-time
          </span>
        </div>
        <div className="hms-bb-stat__value">{issuanceMetrics.total}</div>
        <div className="hms-bb-stat__hint">Total issuances</div>
      </div>
    </div>
  );

  const titleBadge = tab === "stock"
    ? <Badge tone="info">{stats?.availableUnits ?? 0} available</Badge>
    : <Badge tone="violet">{issuanceMetrics.total} issued</Badge>;

  return (
    <div className="zu-page">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <Droplet size={20} className="text-rose-500" />
            Blood Bank
            {titleBadge}
          </span>
        }
        actions={
          tab === "stock" ? (
            <Button variant="primary" onClick={() => setRegisterOpen(true)}>
              <Plus size={14} /> Register bag
            </Button>
          ) : (
            <Button variant="ghost" onClick={reload}>
              <RefreshCw size={14} /> Refresh
            </Button>
          )
        }
      />

      <div className="zu-page-content">
        {/* Tab strip — pill segmented control, same pattern as IPD Billing */}
        <div className="zu-filter-bar">
          <div className="zu-filter-bar__controls">
            <div className="zu-pill-group">
              <button
                type="button"
                onClick={() => setTab("stock")}
                className={`zu-pill-group__btn ${tab === "stock" ? "is-active" : ""}`}
              >
                <Droplet size={13} /> Stock
              </button>
              <button
                type="button"
                onClick={() => setTab("issue")}
                className={`zu-pill-group__btn ${tab === "issue" ? "is-active" : ""}`}
              >
                <History size={13} /> Issue Blood
              </button>
            </div>
          </div>
        </div>

        {tab === "stock" ? renderStockStats() : renderIssueStats()}
        {tab === "stock" && renderMatrix()}

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={
                tab === "stock"
                  ? "Search bag / group / donor…"
                  : "Search bag / patient / admission / doctor…"
              }
            />
          </div>
          <div className="w-44">
            <SearchableSelect
              value={groupFilter}
              onChange={setGroupFilter}
              options={[{ value: "", label: "All groups" }, ...groups.map((g) => ({ value: g.code, label: g.label }))]}
            />
          </div>
          <div className="w-44">
            <SearchableSelect
              value={componentFilter}
              onChange={setComponentFilter}
              options={[{ value: "", label: "All components" }, ...components.map((c) => ({ value: c.code, label: c.label }))]}
            />
          </div>
          {tab === "stock" && (
            <div className="w-44">
              <SearchableSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "", label: "All statuses" },
                  ...statuses
                    .filter((s) => s.code !== "ISSUED")
                    .map((s) => ({ value: s.code, label: s.label })),
                ]}
              />
            </div>
          )}
        </div>

        <Table
          columns={tab === "stock" ? stockColumns : issueColumns}
          data={filteredUnits}
          loading={loading}
          loadingMessage={
            <span className="text-gray-500">
              Loading {tab === "stock" ? "inventory" : "issuance history"}…
            </span>
          }
          rowClassName={(u) => tab === "stock" && u.expiringSoon ? "hms-bb-row is-expiring" : ""}
          emptyMessage={
            <div className="hms-cell-empty">
              <span className="hms-cell-empty__icon">
                {tab === "stock" ? <Droplet size={22} /> : <History size={22} />}
              </span>
              <div className="hms-cell-empty__text">
                {tab === "stock"
                  ? (search || groupFilter || componentFilter || statusFilter
                    ? "No bags match your filters."
                    : "No bags registered yet. Register the first bag to get started.")
                  : (search || groupFilter || componentFilter
                    ? "No issuances match your filters."
                    : "No bags have been issued yet. Bags issued from the Stock view will appear here.")}
              </div>
            </div>
          }
        />
      </div>

      <RegisterBloodUnitModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        hospitalId={hospitalId}
        onSuccess={reload}
      />
      <IssueBloodUnitModal
        isOpen={!!issueUnit}
        onClose={() => setIssueUnit(null)}
        hospitalId={hospitalId}
        unit={issueUnit}
        onSuccess={reload}
      />
    </div>
  );
}
