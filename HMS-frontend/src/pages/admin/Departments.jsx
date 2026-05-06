import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { departmentApi } from '@/utils/api'
import { Building2, Plus, ToggleLeft, ToggleRight, Pencil, X, Check } from 'lucide-react'

const DEPT_TYPES = ['CLINICAL', 'SUPPORT', 'ADMINISTRATIVE']

const TYPE_COLORS = {
  CLINICAL: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  SUPPORT: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  ADMINISTRATIVE: 'bg-slate-100 text-slate-900 dark:text-white border-slate-200 dark:bg-[#1e1e1e] dark:text-slate-300 dark:border-[#333333]',
}

const PRESETS = {
  CLINICAL: [
    { name: 'Medicine', code: 'MED' },
    { name: 'Surgery', code: 'SUR' },
    { name: 'Pediatrics', code: 'PED' },
    { name: 'OB/Gynecology', code: 'OBG' },
    { name: 'Orthopedics', code: 'ORT' },
    { name: 'Cardiology', code: 'CAR' },
    { name: 'Neurology', code: 'NEU' },
    { name: 'Oncology', code: 'ONC' },
    { name: 'Anesthesia', code: 'ANE' },
    { name: 'ENT', code: 'ENT' },
    { name: 'Ophthalmology', code: 'OPH' },
    { name: 'Emergency & Trauma', code: 'EMR' },
    { name: 'Psychiatry', code: 'PSY' },
    { name: 'Dermatology', code: 'DER' },
    { name: 'Nephrology', code: 'NEP' },
    { name: 'Pulmonology', code: 'PUL' },
  ],
  SUPPORT: [
    { name: 'Nursing', code: 'NUR' },
    { name: 'Pharmacy', code: 'PHA' },
    { name: 'Laboratory', code: 'LAB' },
    { name: 'Radiology', code: 'RAD' },
    { name: 'Physiotherapy', code: 'PHY' },
    { name: 'Dietary & Nutrition', code: 'DIT' },
    { name: 'CSSD', code: 'CSS' },
    { name: 'Blood Bank', code: 'BBK' },
    { name: 'Biomedical Engineering', code: 'BME' },
  ],
  ADMINISTRATIVE: [
    { name: 'Administration', code: 'ADM' },
    { name: 'Human Resources', code: 'HRD' },
    { name: 'Finance', code: 'FIN' },
    { name: 'Information Technology', code: 'ITE' },
    { name: 'Medical Records', code: 'MRD' },
    { name: 'Housekeeping', code: 'HKP' },
    { name: 'Security', code: 'SEC' },
  ],
}

const emptyForm = { name: '', type: 'CLINICAL', code: '', description: '' }

export default function Departments() {
  const { user } = useAuth()
  const { notify } = useNotification()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('CLINICAL')

  const load = async () => {
    if (!user?.hospitalId) return
    try {
      setLoading(true)
      setDepartments(await departmentApi.list(user.hospitalId))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.hospitalId])

  const openCreate = (preset = null) => {
    setEditing(null)
    setForm(preset ? { name: preset.name, type: activeTab, code: preset.code, description: '' } : emptyForm)
    setShowModal(true)
  }

  const openEdit = (dept) => {
    setEditing(dept)
    setForm({ name: dept.name, type: dept.type, code: dept.code || '', description: dept.description || '' })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await departmentApi.update(editing.id, { ...form, hospitalId: user.hospitalId })
        notify('Department updated', 'success')
      } else {
        await departmentApi.create({ ...form, hospitalId: user.hospitalId })
        notify('Department created', 'success')
      }
      setShowModal(false)
      load()
    } catch (err) {
      notify(err.response?.data?.message || 'Failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (dept) => {
    try {
      await departmentApi.toggle(dept.id)
      load()
    } catch {
      notify('Failed to update', 'error')
    }
  }

  const grouped = DEPT_TYPES.reduce((acc, t) => {
    acc[t] = departments.filter(d => d.type === t)
    return acc
  }, {})

  const existing = new Set(departments.map(d => d.name))

  const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300/50 focus:border-slate-200 transition-all'
  const labelCls = 'block text-xs font-bold text-slate-600 dark:text-[#aaa] uppercase tracking-wider mb-1.5'

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0d0d0d] gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-slate-700 dark:text-[#cccccc]" /> Departments
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage hospital departments and wings</p>
        </div>
        <button onClick={() => openCreate()} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      <div className="flex gap-2">
        {DEPT_TYPES.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${activeTab === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white dark:bg-[#111] border-slate-200 dark:border-[#2a2a2a] text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}>
            {t.charAt(0) + t.slice(1).toLowerCase()} ({grouped[t]?.length ?? 0})
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#1e1e1e] overflow-hidden flex-1">
        <div className="p-5 border-b border-slate-100 dark:border-[#1e1e1e] flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-white">{activeTab.charAt(0) + activeTab.slice(1).toLowerCase()} Departments</span>
          <span className="text-xs text-slate-400">{grouped[activeTab]?.length ?? 0} departments</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-[#1e1e1e]">
                {['Department', 'Code', 'Type', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e1e1e]">
              {grouped[activeTab]?.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">No departments yet. Add from presets below or create custom.</td></tr>
              )}
              {grouped[activeTab]?.map(dept => (
                <tr key={dept.id} className="group hover:bg-slate-50 dark:hover:bg-[#161616] transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white text-sm">{dept.name}</td>
                  <td className="px-5 py-3.5">
                    {dept.code && <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#222] text-slate-600 dark:text-slate-300 text-xs font-mono">{dept.code}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${TYPE_COLORS[dept.type]}`}>
                      {dept.type.charAt(0) + dept.type.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${dept.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {dept.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => openEdit(dept)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-500 hover:text-slate-900 dark:text-white transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggle(dept)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-500 transition-colors">
                        {dept.isActive ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="border-t border-slate-100 dark:border-[#1e1e1e] p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Add from Presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS[activeTab]?.filter(p => !existing.has(p.name)).map(p => (
              <button key={p.name} onClick={() => openCreate(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-[#333] text-slate-500 dark:text-slate-400 hover:border-slate-400 hover:text-slate-900 dark:text-white dark:hover:text-slate-400 dark:text-[#888] text-xs font-medium transition-colors">
                <Plus className="w-3 h-3" /> {p.name}
              </button>
            ))}
            {PRESETS[activeTab]?.every(p => existing.has(p.name)) && (
              <span className="text-xs text-slate-400">All presets added</span>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111] rounded-lg shadow-xl w-full max-w-md border border-slate-200 dark:border-[#2a2a2a]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#1e1e1e]">
              <h3 className="font-bold text-slate-900 dark:text-white">{editing ? 'Edit Department' : 'New Department'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Department Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className={inputCls} placeholder="e.g. Cardiology" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Type *</label>
                  <select required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls}>
                    {DEPT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Code</label>
                  <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className={inputCls} placeholder="e.g. CAR" maxLength={10} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className={inputCls} rows={2} placeholder="Optional description" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                  <Check className="w-4 h-4" /> {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
