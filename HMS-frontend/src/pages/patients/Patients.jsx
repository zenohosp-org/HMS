import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { patientApi } from "@/utils/api";
import PatientModal from "@/components/modals/PatientModal";
import Pagination from "@/components/ui/Pagination";
import PageHeader from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui";
import { calcAge, formatDate } from "@/utils/validators";
import { fmtId } from "@/utils/idFormat";
import { Search, Loader2, Users, MoreHorizontal, Pencil, ExternalLink } from "lucide-react";

const PAGE_SIZE = 30;

function Patients() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);                  // UI is 1-based
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [modal, setModal] = useState({ open: false, patient: null });
  const [openMenuId, setOpenMenuId] = useState(null);

  const load = () => {
    if (!user?.hospitalId) return;
    setLoading(true);
    patientApi.listPaginated(
      user.hospitalId,
      page - 1,            // backend is 0-based, UI is 1-based
      PAGE_SIZE,
      debouncedSearch
    )
      .then((data) => {
        setPatients(data.patients);
        setTotalPages(data.totalPages);
        setTotalElements(data.totalElements);
      })
      .catch(() => notify("Failed to load patients", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);         // reset to first page on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    load();
  }, [user?.hospitalId, page, debouncedSearch]);

  useEffect(() => {
    if (location.state?.openRegistration) {
      setModal({ open: true, patient: null });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleSave = async (data) => {
    if (modal.patient) {
      await patientApi.update(modal.patient.id, { ...data, hospitalId: user.hospitalId });
      notify("Patient updated", "success");
    } else {
      await patientApi.create({ ...data, hospitalId: user.hospitalId });
      notify("Patient registered", "success");
    }
    setModal({ open: false, patient: null });
    load();
  };

  // Client-side filtering and slicing deleted: handled on backend

  return (
    <div className="zu-page">

      <PageHeader
        title={<>Patients <span className="hms-pat-page__count">{totalElements}</span></>}
        actions={
          <button className="zu-btn-primary" onClick={() => setModal({ open: true, patient: null })}>
            + Register Patient
          </button>
        }
      />

      {/* Search */}
      <div className="hms-pat-search">
        <Search className="w-4 h-4 hms-pat-search__icon" />
        <input
          type="text"
          placeholder="Search by name, UHID or phone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="hms-pat-search__input"
        />
      </div>

      {/* Table card */}
      <div className="hms-pat-table-card">
        <div className="hms-pat-table-wrap">
          <table className="hms-pat-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Age / Gender</th>
                <th>Phone</th>
                <th>Registered</th>
                <th>Blood</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <TableSkeleton rows={10} columns={6} />
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="hms-pat-table-empty">
                      <div className="hms-pat-table-empty__icon">
                        <Users className="w-5 h-5" />
                      </div>
                      <p className="hms-pat-table-empty__text">
                        {search ? "No patients match your search." : "No patients registered yet."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                patients.map((p) => {
                  const initials = `${p.firstName[0]}${p.lastName?.[0] ?? ""}`.toUpperCase();
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="hms-pat-id-cell">
                          <div className="hms-pat-id-cell__avatar">
                            {initials}
                          </div>
                          <div>
                            <p className="hms-pat-id-cell__name">
                              {p.firstName} {p.lastName}
                            </p>
                            <p className="hms-pat-id-cell__uhid">{fmtId(p.uhid)}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {p.dob ? `${calcAge(p.dob)}y` : "—"} &nbsp;·&nbsp; {p.gender}
                      </td>
                      <td>
                        {p.phone ?? <span className="hms-pat-mute">—</span>}
                      </td>
                      <td>
                        {formatDate(p.createdAt)}
                      </td>
                      <td>
                        {p.bloodGroup
                          ? <span className="hms-pat-blood">{p.bloodGroup}</span>
                          : <span className="hms-pat-mute">—</span>
                        }
                      </td>
                      <td className="is-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === p.id ? null : p.id);
                          }}
                          className="hms-pat-kebab-btn"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {openMenuId === p.id && (
                          <>
                            <div className="hms-pat-kebab-menu__scrim" onClick={() => setOpenMenuId(null)} />
                            <div
                              className="hms-pat-kebab-menu"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => { setOpenMenuId(null); setModal({ open: true, patient: p }); }}
                                className="hms-pat-kebab-menu__item"
                              >
                                <Pencil className="w-4 h-4" /> Edit Patient
                              </button>
                              <button
                                onClick={() => { setOpenMenuId(null); navigate(`/patients/${p.id}`); }}
                                className="hms-pat-kebab-menu__item"
                              >
                                <ExternalLink className="w-4 h-4" /> Patient Details
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalElements > 0 && (
          <div className="hms-pat-table-pagination">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalElements}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {modal.open && (
        <PatientModal
          patient={modal.patient}
          onClose={() => setModal({ open: false, patient: null })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export { Patients as default };
