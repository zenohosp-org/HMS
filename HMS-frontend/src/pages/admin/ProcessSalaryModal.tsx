import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { bankApi, payrollApi, type StaffPayroll, type BankAccount } from '@/utils/api'
import { X } from 'lucide-react'

interface Props {
    staff: StaffPayroll
    onClose: () => void
    onProcessed: () => void
}

const PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'UPI', 'NEFT', 'RTGS']
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

export default function ProcessSalaryModal({ staff, onClose, onProcessed }: Props) {
    const { user } = useAuth()
    const { notify } = useNotification()

    const now = new Date()
    const [form, setForm] = useState({
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        baseSalary: staff.basicSalary,
        bonus: 0,
        deductions: 0,
        bankAccountId: '',
        paymentMethod: 'Bank Transfer',
        referenceNo: '',
    })
    const [accounts, setAccounts] = useState<BankAccount[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!user?.hospitalId) return
        bankApi.list(user.hospitalId).then(setAccounts).catch(() => {})
    }, [user?.hospitalId])

    const netPayable = form.baseSalary + form.bonus - form.deductions

    const selectedAccount = accounts.find(a => a.id === form.bankAccountId)

    const handleSubmit = async () => {
        if (!user?.hospitalId) return
        if (netPayable <= 0) { notify('Net payable must be greater than zero', 'error'); return }
        setSaving(true)
        try {
            await payrollApi.process({
                hospitalId: user.hospitalId,
                staffId: staff.staffId,
                month: form.month,
                year: form.year,
                baseSalary: form.baseSalary,
                bonus: form.bonus,
                deductions: form.deductions,
                bankAccountId: form.bankAccountId || undefined,
                paymentMethod: form.paymentMethod,
                referenceNo: form.referenceNo || undefined,
            })
            notify('Salary processed successfully', 'success')
            onProcessed()
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            notify(msg ?? 'Failed to process salary', 'error')
        } finally {
            setSaving(false)
        }
    }

    const inputCls = 'w-full rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] px-4 py-2.5 text-sm text-slate-900 dark:text-[#dddddd] focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all'
    const labelCls = 'block text-xs font-semibold text-slate-500 dark:text-[#888888] mb-1.5'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-[#2a2a2a] flex flex-col">

                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 dark:border-[#1e1e1e]">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Process Salary</h2>
                        <p className="text-xs text-slate-400 dark:text-[#666666] mt-0.5">
                            {staff.staffName} · {staff.role}{staff.department ? ` · ${staff.department}` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-[#cccccc] rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-4">

                    {/* Month + Year */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Month</label>
                            <select className={inputCls} value={form.month} onChange={e => setForm(f => ({ ...f, month: +e.target.value }))}>
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Year</label>
                            <input type="number" className={inputCls} value={form.year}
                                onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} />
                        </div>
                    </div>

                    {/* Base Salary + Bonus + Deductions */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className={labelCls}>Base Salary</label>
                            <input type="number" className={inputCls} value={form.baseSalary}
                                onChange={e => setForm(f => ({ ...f, baseSalary: +e.target.value }))} />
                        </div>
                        <div>
                            <label className={labelCls}>Bonus</label>
                            <input type="number" className={inputCls} value={form.bonus}
                                onChange={e => setForm(f => ({ ...f, bonus: +e.target.value }))} />
                        </div>
                        <div>
                            <label className={labelCls}>Deductions</label>
                            <input type="number" className={inputCls} value={form.deductions}
                                onChange={e => setForm(f => ({ ...f, deductions: +e.target.value }))} />
                        </div>
                    </div>

                    {/* Net Payable */}
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a]">
                        <span className="text-sm font-semibold text-slate-600 dark:text-[#aaaaaa]">Net Payable</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                            ₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>

                    {/* Pay From Account + Method */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Pay From Account</label>
                            <select className={inputCls} value={form.bankAccountId} onChange={e => setForm(f => ({ ...f, bankAccountId: e.target.value }))}>
                                <option value="">Select account</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.accountName} (₹{a.currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                                    </option>
                                ))}
                            </select>
                            {selectedAccount && (
                                <p className="text-[10px] text-slate-400 dark:text-[#555555] mt-1">
                                    Balance after: ₹{(selectedAccount.currentBalance - netPayable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className={labelCls}>Payment Method</label>
                            <select className={inputCls} value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Reference No */}
                    <div>
                        <label className={labelCls}>Reference No. <span className="font-normal">(optional)</span></label>
                        <input className={inputCls} placeholder="e.g. TXN-20260423" value={form.referenceNo}
                            onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))} />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-[#1e1e1e] flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-[#aaaaaa] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Processing…' : 'Confirm Payment'}
                    </button>
                </div>
            </div>
        </div>
    )
}
