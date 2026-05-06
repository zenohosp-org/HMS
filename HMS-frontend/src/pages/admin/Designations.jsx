import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { departmentApi, designationApi } from '@/utils/api'
import { Award, Plus, ToggleLeft, ToggleRight, X, Check } from 'lucide-react'

const CATEGORIES = ['MEDICAL', 'NURSING', 'TECHNICAL', 'ADMINISTRATIVE', 'SUPPORT']

const CAT_COLORS = {
  MEDICAL: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  NURSING: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20',
  TECHNICAL: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  ADMINISTRATIVE: 'bg-slate-100 text-slate-900 dark:text-white border-slate-200 dark:bg-[#1e1e1e] dark:text-slate-300 dark:border-[#333333]',
  SUPPORT: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
}

const PRESETS = {
  MEDICAL: ['Senior Consultant', 'Consultant', 'Associate Consultant', 'Senior Resident', 'Junior Resident', 'House Surgeon', 'Registrar'],
  NURSING: ['Chief Nursing Officer', 'Nursing Superintendent', 'Deputy Nursing Superintendent', 'Ward Sister', 'Staff Nurse', 'Junior Staff Nurse', 'ANM'],
  TECHNICAL: ['Senior Radiographer', 'Radiographer', 'Senior Lab Technician', 'Lab Technician', 'Lab Assistant', 'Pharmacist', 'Senior Pharmacist', 'Physiotherapist', 'Dietitian'],
  ADMINISTRATIVE: ['Hospital Administrator', 'Department Manager', 'Executive', 'Officer', 'Coordinator', 'Receptionist', 'Medical Records Officer', 'Billing Executive'],
  SUPPORT: ['Senior Attender', 'Attender', 'Helper', 'Security Officer', 'Housekeeping Supervisor', 'Housekeeping Staff'],
}

const emptyForm = { name: '', category: 'MEDICAL', departmentId: '' }

export default function Designations() {
  const { user } = useAuth()
  const { notify } = useNotification()
  const [designations, setDesignations] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('MEDICAL')
  const [deptFilter, setDeptFilter] = useState('')

  const load = async () => {
    if (!user?.hospitalId) return
    try {
      setLoading(true)
      const [desigs, depts] = await Promise.all([
        designationApi.list(user.hospitalId),
        departmentApi.list(user.hospitalId, true),
      ])
      setDesignations(desigs)
      setDepartments(depts)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.hospitalId])

  const openCreate = (preset = null) => {
    setForm(preset ? { name: preset, category: activeTab, departmentId: '' } : { ...emptyForm, category: activeTab })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await designationApi.create({
        hospitalId: user.hospitalId,
        name: form.name,
        category: form.category,
        departmentId: form.departmentId || null,
      })
      notify('Designation created', 'success')
      setShowModal(false)
      load()
    } catch (err) {
      notify(err.response?.data?.message || 'Failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (d) => {
    try { await designationApi.toggle(d.id); load() }
    catch { notify('Failed', 'error') }
  }

  const grouped = CATEGORIES.reduce((acc, c) => {
    acc[c] = designations.filter(d => d.category === c &&
      (!deptFilter || d.departmentId === deptFilter || !d.departmentId))
    return acc
  }, {})

  const existing = new Set(designations.map(d => d.name))

  const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-200 transition-all'
  const labelCls = 'block text-xs font-bold text-slate-600 dark:text-[#aaa] uppercase tracking-wider mb-1.5'

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0d0d0d] gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-slate-700 dark:text-[#cccccc]" /> Designations
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Job titles and roles across departments</p>
        </div>
        <button onClick={() => openCreate()} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Designation
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActiveTab(c)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeTab === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-[#111] border-slate-200 dark:border-[#2a2a2a] text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}>
              {c.charAt(0) + c.slice(1).toLowerCase()} ({grouped[c]?.length ?? 0})
            </button>
          ))}
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="ml-auto rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] text-sm text-slate-700 dark:text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300/50">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] overflow-hidden flex-1">
        <div className="p-5 border-b border-slate-100 dark:border-[#1e1e1e] flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-white">{activeTab.charAt(0) + activeTab.slice(1).toLowerCase()} Designations</span>
          <span className="text-xs text-slate-400">{grouped[activeTab]?.length ?? 0} titles</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1e1e1e]">
                {['Title', 'Category', 'Department', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e1e]">
              {grouped[activeTab]?.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">No designations yet. Add from presets below.</td></tr>
              )}
              {grouped[activeTab]?.map(d => (
                <tr key={d.id} className="group hover:bg-slate-50 dark:hover:bg-[#161616] transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white text-sm">{d.name}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${CAT_COLORS[d.category]}`}>
                      {d.category.charAt(0) + d.category.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400">{d.departmentName || <span className="text-slate-300 dark:text-slate-600">Cross-department</span>}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${d.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggle(d)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-500 transition-colors">
                        {d.isActive ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="border-t border-slate-100 dark:border-[#1e1e1e] p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Add Presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS[activeTab]?.filter(p => !existing.has(p)).map(p => (
              <button key={p} onClick={() => openCreate(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-[#333] text-slate-500 dark:text-slate-400 hover:border-slate-400 hover:text-slate-900 dark:text-white dark:hover:text-slate-400 dark:text-[#888] text-xs font-medium transition-colors">
                <Plus className="w-3 h-3" /> {p}
              </button>
            ))}
            {PRESETS[activeTab]?.every(p => existing.has(p)) && (
              <span className="text-xs text-slate-400">All presets added</span>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111] rounded-lg shadow-xl w-full max-w-md border border-slate-200 dark:border-[#2a2a2a]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#1e1e1e]">
              <h3 className="font-bold text-slate-900 dark:text-white">New Designation</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Title / Designation *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className={inputCls} placeholder="e.g. Staff Nurse" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Category *</label>
                  <select required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Department</label>
                  <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className={inputCls}>
                    <option value="">Cross-department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                  <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
