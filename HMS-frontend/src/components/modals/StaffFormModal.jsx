import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { staffApi, departmentApi, designationApi } from '@/utils/api'
import { X, User as UserIcon, ShieldAlert, Building2, Award } from 'lucide-react'
import StateSelect from '@/components/StateSelect'

export default function StaffFormModal({ onClose, onSaved, editStaff }) {
  const { user } = useAuth()
  const { notify } = useNotification()
  const [submitting, setSubmitting] = useState(false)
  const [departments, setDepartments] = useState([])
  const [designations, setDesignations] = useState([])

  const [form, setForm] = useState({
    firstName: editStaff?.firstName || '',
    lastName: editStaff?.lastName || '',
    email: editStaff?.email || '',
    password: '',
    phone: editStaff?.phone || '',
    role: editStaff?.role || 'staff',
    employeeCode: editStaff?.employeeCode || '',
    designation: editStaff?.designationName || editStaff?.designation || '',
    gender: editStaff?.gender || 'OTHER',
    dateOfJoining: editStaff?.dateOfJoining || '',
    state: editStaff?.state || '',
    departmentId: editStaff?.departmentId || '',
    designationId: editStaff?.designationId || '',
  })

  useEffect(() => {
    if (!user?.hospitalId) return
    departmentApi.list(user.hospitalId, true).then(setDepartments).catch(() => {})
  }, [user?.hospitalId])

  useEffect(() => {
    if (!user?.hospitalId) return
    designationApi.list(user.hospitalId, true, form.departmentId || null).then(setDesignations).catch(() => {})
  }, [user?.hospitalId, form.departmentId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user?.hospitalId) return
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
      }
      if (editStaff) {
        await staffApi.update(editStaff.id, payload)
        notify('Staff profile updated', 'success')
      } else {
        await staffApi.create({ ...payload, hospitalId: user.hospitalId })
        notify('Staff access created successfully', 'success')
      }
      onSaved()
    } catch (error) {
      notify(error.response?.data?.error || 'Operation failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all'
  const labelCls = 'block text-xs font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider mb-2'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#000000]/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#2a2a2a]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-[#1e1e1e]">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-violet-500" />
            {editStaff ? 'Edit Staff Profile' : 'Add New Staff'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="staffForm" onSubmit={handleSubmit} className="space-y-8">

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" /> Account & Access
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Email Address *</label>
                  <input required type="email" value={form.email} disabled={!!editStaff}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className={inputCls + (editStaff ? ' opacity-50 cursor-not-allowed' : '')}
                    placeholder="staff@hospital.com" />
                </div>
                {!editStaff && (
                  <div>
                    <label className={labelCls}>Temporary Password *</label>
                    <input required type="password" value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      className={inputCls} placeholder="Minimum 6 characters" />
                  </div>
                )}
                <div className={editStaff ? 'col-span-2' : 'col-span-2'}>
                  <label className={labelCls}>System Role *</label>
                  <select required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputCls}>
                    <option value="staff">General Staff</option>
                    <option value="hospital_admin">Hospital Administrator</option>
                    <option value="technician">Technician</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Hospital Administrators have full authority over all modules.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2">
                Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <input required type="text" value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className={inputCls} placeholder="Jane" />
                </div>
                <div>
                  <label className={labelCls}>Last Name *</label>
                  <input required type="text" value={form.lastName}
                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className={inputCls} placeholder="Smith" />
                </div>
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <input type="text" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className={inputCls} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className={labelCls}>Gender *</label>
                  <select required value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className={inputCls}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <StateSelect value={form.state} onChange={val => setForm({ ...form, state: val })}
                    inputClassName={inputCls} labelClassName={labelCls} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-[#2a2a2a] pb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" /> Organizational Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Employee Code</label>
                  <input type="text" value={form.employeeCode}
                    onChange={e => setForm({ ...form, employeeCode: e.target.value })}
                    className={inputCls} placeholder="e.g. EMP-1042" />
                </div>
                <div>
                  <label className={labelCls}>Date of Joining</label>
                  <input type="date" value={form.dateOfJoining}
                    onChange={e => setForm({ ...form, dateOfJoining: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Department</label>
                  <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value, designationId: '' })} className={inputCls}>
                    <option value="">Select department…</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.type.charAt(0) + d.type.slice(1).toLowerCase()})</option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <p className="text-[10px] text-amber-500 mt-1">No departments yet — add them in HR &amp; Staff → Departments</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Designation / Title</label>
                  <select value={form.designationId} onChange={e => setForm({ ...form, designationId: e.target.value })} className={inputCls}>
                    <option value="">Select designation…</option>
                    {designations.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.category.charAt(0) + d.category.slice(1).toLowerCase()})</option>
                    ))}
                  </select>
                  {designations.length === 0 && form.departmentId && (
                    <p className="text-[10px] text-slate-500 mt-1">No designations for this department — add in HR &amp; Staff → Designations</p>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-[#1e1e1e] flex justify-end gap-3 bg-slate-50 dark:bg-[#0a0a0a]">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-200 dark:hover:bg-[#222222] transition-colors">
            Cancel
          </button>
          <button type="submit" form="staffForm" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving…' : editStaff ? 'Save Changes' : 'Create Staff Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
