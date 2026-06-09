import { useEffect, useMemo, useState } from "react";
import { Users, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { bloodBankApi } from "@/utils/api";
import { Badge, Button, PageHeader, SearchBar, Table } from "@/components/ui";
import RegisterDonorModal from "@/components/modals/RegisterDonorModal";

export default function BloodDonors() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [donors, setDonors] = useState([]);
  const [donorTypes, setDonorTypes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);

  const hospitalId = user?.hospitalId;

  const reload = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const [d, t, g] = await Promise.all([
        bloodBankApi.listDonors(hospitalId),
        bloodBankApi.listLookups(hospitalId, "DONOR_TYPE").catch(() => []),
        bloodBankApi.listLookups(hospitalId, "BLOOD_GROUP").catch(() => []),
      ]);
      setDonors(d);
      setDonorTypes(t);
      setGroups(g);
    } catch {
      notify("Failed to load donors", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId]);

  const typeByCode = useMemo(() => {
    const m = {};
    donorTypes.forEach((t) => { m[t.code] = t; });
    return m;
  }, [donorTypes]);

  const groupByCode = useMemo(() => {
    const m = {};
    groups.forEach((g) => { m[g.code] = g; });
    return m;
  }, [groups]);

  const filtered = useMemo(() => {
    if (!search) return donors;
    const q = search.toLowerCase();
    return donors.filter(
      (d) =>
        d.firstName?.toLowerCase().includes(q) ||
        d.lastName?.toLowerCase().includes(q) ||
        d.phone?.toLowerCase().includes(q) ||
        d.donorCode?.toLowerCase().includes(q)
    );
  }, [donors, search]);

  const columns = [
    {
      header: "Code",
      width: "10%",
      render: (d) => <span className="font-semibold text-gray-900">{d.donorCode}</span>,
    },
    {
      header: "Donor",
      width: "28%",
      render: (d) => (
        <div>
          <div className="font-semibold text-gray-900">{d.firstName} {d.lastName ?? ""}</div>
          <div className="text-xs text-gray-500">{d.phone || "—"}{d.email ? ` · ${d.email}` : ""}</div>
        </div>
      ),
    },
    {
      header: "Group",
      width: "10%",
      render: (d) => (
        <span className="hms-bb-group">
          {(groupByCode[d.bloodGroupCode]?.label) || d.bloodGroupCode}
        </span>
      ),
    },
    {
      header: "Type",
      width: "14%",
      render: (d) => <Badge tone="info" soft>{typeByCode[d.donorTypeCode]?.label || d.donorTypeCode || "—"}</Badge>,
    },
    {
      header: "Total donations",
      width: "12%",
      align: "right",
      render: (d) => <span className="font-semibold text-gray-700 tabular-nums">{d.totalDonations ?? 0}</span>,
    },
    {
      header: "Last donation",
      width: "14%",
      render: (d) => d.lastDonationDate || <span className="text-gray-400">—</span>,
    },
    {
      header: "Eligible",
      width: "12%",
      render: (d) =>
        d.isEligible
          ? <Badge tone="success" soft>Yes</Badge>
          : <Badge tone="danger" soft>Deferred</Badge>,
    },
  ];

  return (
    <div className="zu-page">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <Users size={20} />
            Blood Donors
            <Badge tone="info">{donors.length} total</Badge>
          </span>
        }
        actions={
          <Button variant="primary" onClick={() => setRegisterOpen(true)}>
            <Plus size={14} /> Register donor
          </Button>
        }
      />

      <div className="zu-page-content">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name, phone or donor code…"
        />

        <Table
          columns={columns}
          data={filtered}
          loading={loading}
          loadingMessage={<span className="text-gray-500">Loading donors…</span>}
          emptyMessage={
            <div className="hms-cell-empty">
              <span className="hms-cell-empty__icon">
                <Users size={22} />
              </span>
              <div className="hms-cell-empty__text">
                {search
                  ? "No donors match your search."
                  : "No donors registered yet."}
              </div>
            </div>
          }
        />
      </div>

      <RegisterDonorModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        hospitalId={hospitalId}
        onSuccess={reload}
      />
    </div>
  );
}
