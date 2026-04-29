import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { admissionApi } from '@/utils/api'
import AdmitPatientModal from './AdmitPatientModal'
import DischargeModal from './DischargeModal'
import {
  BedDouble, Plus, Search, LogOut, User, Building2,
  Stethoscope, Clock, CheckCircle2, List, LayoutGrid,
  Calendar, ChevronRight, AlertCircle
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

const STATUS_COLORS = {
  ADMITTED: 'bg-slate-100 dark:bg-[#1e1e1e] text-slate-900 dark:text-white border-emerald-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-900 dark:border-white/20',
  DISCHARGED: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
  TRANSFERRED: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  ABSCONDED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
}

const TYPE_COLORS = {
  EMERGENCY: 'bg-rose-500 text-white',
  ELECTIVE: 'bg-slate-200 text-slate-700 dark:bg-[#222] dark:text-slate-300',
  REFERRAL: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  TRANSFER: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
}

export default function Admissions() {
  const { user } = useAuth()
  const { notify } = useNotification()
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ADMITTED')
  const [viewMode, setViewMode] = useState('grid')
  const [showAdmitModal, setShowAdmitModal] = useState(false)
  const [dischargeTarget, setDischargeTarget] = useState(null)
  const [selected, setSelected] = useState(null)

  const load = async (all = statusFilter !== 'ADMITTED') => {
    if (!user?.hospitalId) return
    try {
      setLoading(true)
      setAdmissions(await admissionApi.list(user.hospitalId, all || statusFilter === 'ALL'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(statusFilter === 'ALL' || statusFilter === 'DISCHARGED') }, [user?.hospitalId, statusFilter])

  const filtered = useMemo(() => {
    let list = statusFilter === 'ALL' ? admissions : admissions.filter(a => a.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.patientName?.toLowerCase().includes(q) ||
        a.admissionNumber?.toLowerCase().includes(q) ||
        a.departmentName?.toLowerCase().includes(q) ||
        a.roomNumber?.toLowerCase().includes(q)
      )
    }
    return list
  }, [admissions, statusFilter, search])

  const counts = useMemo(() => ({
    ADMITTED: admissions.filter(a => a.status === 'ADMITTED').length,
    DISCHARGED: admissions.filter(a => a.status === 'DISCHARGED').length,
  }), [admissions])

  const formatAdmissionDate = (dateStr) => {
    if (!dateStr) return '—'
    try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }) } catch { return dateStr }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try { return format(new Date(dateStr), 'dd MMM yyyy, h:mm a') } catch { return dateStr }
  }

  const isOverdue = (a) => {
    if (!a.approxDischargeDate || a.status !== 'ADMITTED') return false
    return new Date(a.approxDischargeDate) < new Date()
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0d0d0d] p-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BedDouble className="w-6 h-6 text-violet-500" /> IPD Admissions
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">In-patient department — active admissions and discharge management</p>
        </div>
        <button onClick={() => setShowAdmitModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Admit Patient
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active Admissions', value: counts.ADMITTED, icon: BedDouble, color: 'text-slate-900 dark:text-white', bg: 'bg-slate-100 dark:bg-[#1e1e1e] dark:bg-slate-500/10' },
          { label: 'Discharged Today', value: admissions.filter(a => a.status === 'DISCHARGED' && a.actualDischargeDate?.startsWith(new Date().toISOString().slice(0, 10))).length, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: 'Overdue Discharge', value: admissions.filter(isOverdue).length, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-500/10' },
          { label: 'Total This Month', value: admissions.filter(a => a.createdAt?.startsWith(new Date().toISOString().slice(0, 7))).length, icon: Calendar, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl bg-white dark:bg-[#111] border border-slate-200 dark:border-[#1e1e1e] p-4 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            placeholder="Search by patient, admission no., department, room…" />
        </div>
        {['ADMITTED', 'DISCHARGED', 'ALL'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${statusFilter === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-[#111] border-slate-200 dark:border-[#2a2a2a] text-slate-600 dark:text-slate-300 hover:border-violet-400'}`}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
            {s === 'ADMITTED' && counts.ADMITTED > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white text-xs">{counts.ADMITTED}</span>}
          </button>
        ))}
        <div className="flex border border-slate-200 dark:border-[#2a2a2a] rounded-xl overflow-hidden ml-auto">
          {[['grid', LayoutGrid], ['list', List]].map(([mode, Icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`p-2.5 transition-colors ${viewMode === mode ? 'bg-violet-600 text-white' : 'bg-white dark:bg-[#111] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#1a1a1a]'}`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">Loading admissions…</div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
          <BedDouble className="w-12 h-12 opacity-30" />
          <p className="text-sm">No admissions found</p>
          <button onClick={() => setShowAdmitModal(true)} className="text-violet-600 text-sm font-semibold hover:underline">Admit a patient →</button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-2">
          {filtered.map(a => (
            <div key={a.id} onClick={() => setSelected(selected?.id === a.id ? null : a)}
              className={`rounded-2xl bg-white dark:bg-[#111] border transition-all cursor-pointer ${selected?.id === a.id ? 'border-violet-400 shadow-lg shadow-violet-500/10' : 'border-slate-200 dark:border-[#1e1e1e] hover:border-violet-300 hover:shadow-md'} ${isOverdue(a) ? 'border-l-4 border-l-rose-400' : ''}`}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{a.patientName}</p>
                      <p className="text-xs text-slate-500">MRN: {a.patientMrn}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${TYPE_COLORS[a.admissionType]}`}>
                    {a.admissionType}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{a.departmentName || 'No department'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BedDouble className="w-3.5 h-3.5 shrink-0" />
                    <span>{a.roomNumber ? `Room ${a.roomNumber} · ${a.roomType}` : 'Room not assigned'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                    <span>{a.admittingDoctorName ? `Dr. ${a.admittingDoctorName}` : 'No doctor assigned'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatAdmissionDate(a.admissionDate)}</span>
                    {isOverdue(a) && <span className="text-rose-500 font-semibold">· Overdue</span>}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1e1e1e] flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[a.status]}`}>{a.status}</span>
                  <span className="text-xs font-mono text-slate-400">{a.admissionNumber}</span>
                </div>
              </div>
              {a.status === 'ADMITTED' && (
                <div className="px-4 pb-4 flex gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setDischargeTarget(a)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/20 transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Discharge
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-[#111] border border-slate-200 dark:border-[#1e1e1e] overflow-hidden flex-1">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1e1e1e]">
                {['Adm. No.', 'Patient', 'Department', 'Room', 'Doctor', 'Admitted', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e1e]">
              {filtered.map(a => (
                <tr key={a.id} className={`hover:bg-slate-50 dark:hover:bg-[#161616] transition-colors ${isOverdue(a) ? 'border-l-4 border-l-rose-400' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.admissionNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{a.patientName}</p>
                    <p className="text-xs text-slate-500">{a.patientMrn}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{a.departmentName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{a.roomNumber || <span className="text-amber-500 text-xs">Not assigned</span>}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{a.admittingDoctorName ? `Dr. ${a.admittingDoctorName}` : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatAdmissionDate(a.admissionDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[a.status]}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status === 'ADMITTED' && (
                      <button onClick={() => setDischargeTarget(a)}
                        className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 transition-colors">
                        <LogOut className="w-3.5 h-3.5" /> Discharge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdmitModal && (
        <AdmitPatientModal
          onClose={() => setShowAdmitModal(false)}
          onAdmitted={() => { setShowAdmitModal(false); notify('Patient admitted successfully', 'success'); load(statusFilter !== 'ADMITTED') }}
        />
      )}
      {dischargeTarget && (
        <DischargeModal
          admission={dischargeTarget}
          onClose={() => setDischargeTarget(null)}
          onDischarged={() => { setDischargeTarget(null); notify('Patient discharged', 'success'); load(statusFilter !== 'ADMITTED') }}
        />
      )}
    </div>
  )
}
