import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { 
    patientApi, 
    specializationApi, 
    appointmentsApi, 
    hospitalServiceApi, 
    invoiceApi,
    type Patient, 
    type Specialization, 
    type Appointment, 
    type HospitalService,
    type Invoice,
    type InvoiceItem
} from '@/utils/api'
import { generateInvoiceNumber, formatDate } from '@/utils/validators'
import { useNotification } from '@/context/NotificationContext'
import { Printer, Save, Plus, Trash2, Search, Calendar, Stethoscope, ChevronDown, History as HistoryIcon } from 'lucide-react'
import SearchSelect from '@/components/ui/SearchSelect'

export default function CreateInvoice() {
    const { user } = useAuth()
    const { notify } = useNotification()
    const navigate = useNavigate()
    const [params] = useSearchParams()
    
    // Core Data
    const [patient, setPatient] = useState<Patient | null>(null)
    const [specialization, setSpecialization] = useState<Specialization | null>(null)
    const [appointment, setAppointment] = useState<Appointment | null>(null)
    const [services, setServices] = useState<HospitalService[]>([])
    
    // Invoice State
    const [invoiceNo] = useState(generateInvoiceNumber())
    const [today] = useState(formatDate(new Date().toISOString()))
    const [items, setItems] = useState<Partial<InvoiceItem>[]>([
        { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }
    ])
    const [notes, setNotes] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    // Load initial data
    useEffect(() => {
        const pId = params.get('patientId')
        if (pId && user?.hospitalId) {
            patientApi.get(Number(pId), user.hospitalId).then(setPatient).catch(console.error)
        }
        if (user?.hospitalId) {
            hospitalServiceApi.list(user.hospitalId).then(setServices).catch(console.error)
        }
    }, [params, user?.hospitalId])

    // Load patient appointments when patient is selected
    const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([])
    useEffect(() => {
        if (patient?.id) {
            appointmentsApi.getByPatient(patient.id).then(setPatientAppointments).catch(console.error)
        } else {
            setPatientAppointments([])
        }
    }, [patient])

    // Calculations
    const subtotal = useMemo(() => items.reduce((s, i) => s + (i.totalPrice || 0), 0), [items])
    const taxRate = 0.08 // 8% as per reference
    const tax = subtotal * taxRate
    const total = subtotal + tax

    // Handlers
    const addItem = () => setItems(p => [...p, { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }])
    const removeItem = (idx: number) => setItems(p => p.filter((_, i) => i !== idx))
    
    const updateItem = (idx: number, updates: Partial<InvoiceItem>) => {
        setItems(p => p.map((item, i) => {
            if (i !== idx) return item
            const newItem = { ...item, ...updates }
            if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
                newItem.totalPrice = (newItem.quantity || 0) * (newItem.unitPrice || 0)
            }
            return newItem
        }))
    }

    const handleServiceSelect = (idx: number, service: HospitalService) => {
        updateItem(idx, {
            serviceId: service.id,
            description: service.name,
            unitPrice: service.price,
            totalPrice: (items[idx].quantity || 1) * service.price
        })
    }

    const handleSave = async (isPrint: boolean = false) => {
        if (!patient || !user?.hospitalId) {
            notify('Please select a patient first', 'warning')
            return
        }
        if (items.some(i => !i.description || (i.totalPrice || 0) <= 0)) {
            notify('Please complete all item details', 'error')
            return
        }

        setIsSaving(true)
        try {
            const payload: Partial<Invoice> = {
                invoiceNumber: invoiceNo,
                hospitalId: user.hospitalId,
                patientId: patient.id!,
                appointmentId: appointment?.id,
                specializationId: specialization?.id,
                subtotal,
                tax,
                discount: 0,
                total,
                notes,
                status: 'UNPAID',
                items: items.map(i => ({
                    description: i.description!,
                    quantity: i.quantity!,
                    unitPrice: i.unitPrice!,
                    totalPrice: i.totalPrice!,
                    serviceId: i.serviceId
                }))
            }
            await invoiceApi.create(payload)
            notify('Invoice generated and stored successfully!', 'success')
            if (isPrint) window.print()
        } catch (err) {
            notify('Failed to save invoice', 'error')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header / Controls */}
            <div className="no-print flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#222222]">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Invoice</h1>
                    <p className="text-sm text-slate-500 font-medium">Generate and track hospital bills</p>
                </div>
                <div className="flex gap-3">
                    {user?.role === 'hospital_admin' && (
                        <button 
                            className="btn-secondary flex items-center gap-2" 
                            onClick={() => navigate('/billing/invoices')}
                        >
                            <HistoryIcon className="w-4 h-4" /> View Invoices
                        </button>
                    )}
                    <button 
                        className="btn-primary flex items-center gap-2" 
                        onClick={() => handleSave(true)}
                        disabled={isSaving}
                    >
                        <Printer className="w-4 h-4" /> Save & Print
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
                {/* Selectors Panel */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white dark:bg-[#111111] p-5 rounded-2xl border border-slate-200 dark:border-[#222222] shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-[#aaaaaa] uppercase tracking-wider">Billing Context</h3>
                        
                        <SearchSelect<Patient>
                            label="Patient"
                            value={patient}
                            onChange={setPatient}
                            onSearch={async (q) => patientApi.search(user?.hospitalId!, q)}
                            getDisplayValue={(p) => `${p.firstName} ${p.lastName}`}
                            renderItem={(p) => (
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#2a2a2a] flex items-center justify-center font-bold text-xs">
                                        {p.firstName[0]}{p.lastName[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-900 dark:text-white">{p.firstName} {p.lastName}</div>
                                        <div className="text-xs text-slate-500">{p.mrn}</div>
                                    </div>
                                </div>
                            )}
                            placeholder="Find patient..."
                        />

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Specialization (Optional)</label>
                            <div className="relative group">
                                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select 
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-sm appearance-none outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    value={specialization?.id || ''}
                                    onChange={(e) => {
                                        const s = services.find(srv => srv.specializationId === e.target.value) // Simplified for mock
                                        setSpecialization({ id: e.target.value } as any)
                                    }}
                                >
                                    <option value="">General / All</option>
                                    {/* Map actual specializations here if fetched */}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Link Appointment</label>
                            <div className="relative group">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select 
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl text-sm appearance-none outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    value={appointment?.id || ''}
                                    onChange={(e) => setAppointment(patientAppointments.find(a => a.id === e.target.value) || null)}
                                    disabled={!patient}
                                >
                                    <option value="">No appointment linked</option>
                                    {patientAppointments.map(a => (
                                        <option key={a.id} value={a.id}>{a.apptDate} - {a.doctorName}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items & Services Table - Premium Layout */}
                <div className="lg:col-span-2 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-[#222222] shadow-sm overflow-hidden p-6 transition-all">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Items & Services</h2>
                        <button className="btn-secondary text-xs !bg-slate-900 dark:!bg-white !text-white dark:!text-slate-900 border-none px-4 py-2" onClick={addItem}>
                            <Plus className="w-3.5 h-3.5" /> Add Item
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-[#222222] pb-2">
                            <div className="col-span-6">Description</div>
                            <div className="col-span-2 text-center">Quantity</div>
                            <div className="col-span-2 text-right">Unit Price</div>
                            <div className="col-span-2 text-right pr-8">Total</div>
                        </div>

                        {/* Line Items */}
                        <div className="space-y-4">
                            {items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-4 items-start group">
                                    <div className="col-span-6 space-y-2">
                                        <select 
                                            className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 dark:text-white transition-colors"
                                            value={item.serviceId || ''}
                                            onChange={(e) => {
                                                const srv = services.find(s => s.id === e.target.value)
                                                if (srv) handleServiceSelect(idx, srv)
                                            }}
                                        >
                                            <option value="">Select service or item</option>
                                            {services.filter(s => !specialization || s.specializationId === specialization.id).map(s => (
                                                <option key={s.id} value={s.id}>{s.name} - ₹{s.price}</option>
                                            ))}
                                        </select>
                                        <input 
                                            className="w-full bg-transparent border border-slate-100 dark:border-[#2a2a2a] rounded-lg px-3 py-2 text-[11px] text-slate-600 dark:text-slate-400 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-emerald-500"
                                            placeholder="Additional description"
                                            value={item.description}
                                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg px-3 py-2 text-center text-xs outline-none focus:border-emerald-500 dark:text-white"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg px-3 py-2 text-right text-xs outline-none focus:border-emerald-500 dark:text-white"
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end gap-3 text-right">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">₹{(item.totalPrice || 0).toFixed(2)}</span>
                                        <button 
                                            className="text-slate-400 hover:text-red-500 transition-colors bg-slate-100 dark:bg-white/5 p-1.5 rounded-lg opacity-0 group-hover:opacity-100"
                                            onClick={() => removeItem(idx)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer / Summary */}
                    <div className="mt-12 flex justify-end">
                        <div className="w-full max-w-[240px] space-y-3 pt-6 border-t border-slate-100 dark:border-[#222222]">
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                                <span>Subtotal:</span>
                                <span>₹{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                                <span>Tax (8%):</span>
                                <span>₹{tax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                                <span>Discount:</span>
                                <span>-₹0.00</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t border-slate-100 dark:border-[#222222] pt-3 text-emerald-600 dark:text-emerald-400">
                                <span>Total:</span>
                                <span>₹{total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PRINT VIEW - Hidden on screen */}
            <div className="print-only hidden print:block bg-white text-black p-8">
                {/* Simplified Print Invoice Structure */}
                <h1 className="text-2xl font-bold mb-4">{user?.hospitalName}</h1>
                <p>Invoice #: {invoiceNo}</p>
                <p>Date: {today}</p>
                <div className="mt-8 border-t border-black pt-4">
                    <p className="font-bold">Bill To:</p>
                    <p>{patient?.firstName} {patient?.lastName}</p>
                    <p>MRN: {patient?.mrn}</p>
                </div>
                <table className="w-full mt-8 border-collapse">
                    <thead>
                        <tr className="border-b-2 border-black">
                            <th className="text-left py-2">Service</th>
                            <th className="text-center py-2">Qty</th>
                            <th className="text-right py-2">Rate</th>
                            <th className="text-right py-2">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((i, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                                <td className="py-2">{i.description}</td>
                                <td className="text-center py-2">{i.quantity}</td>
                                <td className="text-right py-2">₹{i.unitPrice?.toFixed(2)}</td>
                                <td className="text-right py-2">₹{i.totalPrice?.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="mt-8 text-right space-y-2">
                    <p>Subtotal: ₹{subtotal.toFixed(2)}</p>
                    <p>Tax (8%): ₹{tax.toFixed(2)}</p>
                    <p className="font-bold text-xl">Grand Total: ₹{total.toFixed(2)}</p>
                </div>
            </div>
        </div>
    )
}
