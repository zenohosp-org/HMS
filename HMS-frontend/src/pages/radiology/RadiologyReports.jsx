import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { radiologyApi } from "@/utils/api";
import { fmtId } from "@/utils/idFormat";
import Pagination from "@/components/ui/Pagination";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { FileText, Search, Loader2, CheckCircle2, User, Clock, ExternalLink } from "lucide-react";
const PAGE_SIZE = 30;
const PRIORITY_CLS = {
  ROUTINE: "is-routine",
  URGENT: "is-urgent",
  STAT: "is-stat"
};
import { fmtDateTime } from '@/utils/date'
const formatDateTime = fmtDateTime
function RadiologyReports() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ pendingScan: 0, awaitingReport: 0, reportGenerated: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const load = useCallback(async () => {
    if (!user?.hospitalId) return;
    setLoading(true);
    try {
      // "COMPLETED" is a backend alias matching REPORT_GENERATED + BILLED so
      // auto-billed reports don't disappear from this view. The stats endpoint
      // returns the same union under the existing `reportGenerated` key.
      const [reports, statsData] = await Promise.all([
        radiologyApi.list(user.hospitalId, "COMPLETED"),
        radiologyApi.getStats(user.hospitalId)
      ]);
      setOrders(reports);
      setStats(statsData);
    } catch {
      notify("Failed to load reports", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.hospitalId]);
  useEffect(() => {
    load();
  }, [load]);
  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.patientName.toLowerCase().includes(q) || o.patientUhid.toLowerCase().includes(q) || o.serviceName.toLowerCase().includes(q) || o.reportId?.toLowerCase().includes(q);
  });
  return (
    <div className="zu-page">
      <PageHeader
        title="Radiology Reports"
        subtitle="View and manage completed radiology reports"
        actions={
          <div className="hms-rad-chip-row">
            <span className="hms-rad-chip is-emerald">
              <CheckCircle2 className="w-3 h-3" /> {stats.reportGenerated} total reports
            </span>
          </div>
        }
      />
      <div className="zu-page-content">
      {/* Search */}
      <div className="hms-rad-rep-search">
        <Search className="w-4 h-4 hms-rad-rep-search__icon" />
        <input
          className="hms-rad-rep-search__input"
          placeholder="Search by patient, investigation, UHID, report ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {/* Reports table */}
      <div className="hms-rad-section is-slate">
        <div className="hms-rad-section__head">
          <p className="hms-rad-section__title">Completed Reports</p>
          <p className="hms-rad-section__sub">Radiology reports with findings</p>
        </div>
        {loading ? (
          <div className="hms-rad-section__loading">
            <TableSkeleton rows={6} columns={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="hms-rad-rep-empty">
            <FileText className="w-5 h-5 opacity-30" />
            <p className="text-13">{search ? "No reports match your search" : "No completed reports yet"}</p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="hms-rad-table-head is-reports">
              {["Patient", "Investigation", "Referred By", "Completed", "Priority", "Action"].map((h) => (
                <p key={h} className="hms-rad-table-head__cell">{h}</p>
              ))}
            </div>
            <div className="hms-rad-section__list">
              {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((order) => (
                <div key={order.id} className="hms-rad-row is-reports">
                  {/* Patient */}
                  <div className="hms-rad-patient">
                    <div className="hms-rad-patient__avatar">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="hms-rad-patient__name">{order.patientName}</p>
                      <p className="hms-rad-patient__uhid">{fmtId(order.patientUhid)}</p>
                    </div>
                  </div>
                  {/* Investigation */}
                  <div>
                    <p className="hms-rad-row__svc-name">{order.serviceName}</p>
                    {order.billNo && <p className="hms-rad-row__svc-bill">{order.billNo}</p>}
                  </div>
                  {/* Referred by */}
                  <div className="hms-rad-tech">
                    <p>{order.referredByName ?? "—"}</p>
                  </div>
                  {/* Completed */}
                  <div className="hms-rad-row__date">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{formatDateTime(order.reportedAt)}</span>
                  </div>
                  {/* Priority */}
                  <div>
                    <span className={`hms-rad-priority ${PRIORITY_CLS[order.priority]}`}>{order.priority}</span>
                  </div>
                  {/* Action */}
                  <div>
                    <button
                      onClick={() => navigate(`/radiology/reports/${order.id}`)}
                      className="hms-rad-row__view-btn"
                    >
                      <ExternalLink className="w-3 h-3" /> View Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hms-rad-rep-pagination">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
export {
  RadiologyReports as default
};
