import { useState, useEffect, useMemo } from 'react'
import { invoiceApi, hospitalServiceApi, admissionApi, radiologyApi, patientServicesApi } from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import {
  X, Receipt, BedDouble, ScanLine, Stethoscope,
  Pill, FlaskConical, Wrench, Loader2, AlertCircle,
} from 'lucide-react'

const TYPE_META = {
  ROOM_CHARGE:  { label: 'Room',         icon: BedDouble,    color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-500/10' },
  CONSULTATION: { label: 'Consultation', icon: Stethoscope,  color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-500/10'     },
  RADIOLOGY:    { label: 'Radiology',    icon: ScanLine,     color: 'text-violet-600 dark:text-violet-400',  bg: 'bg-violet-50 dark:bg-violet-500/10' },
  LAB_TEST:     { label: 'Lab Test',     icon: FlaskConical, color: 'text-teal-600 dark:text-teal-400',      bg: 'bg-teal-50 dark:bg-teal-500/10'     },
  MEDICINE:     { label: 'Medicine',     icon: Pill,         color: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-50 dark:bg-emerald-500/10'},
  CUSTOM:       { label: 'Custom',       icon: Wrench,       color: 'text-slate-600 dark:text-[#aaa]',       bg: 'bg-slate-100 dark:bg-[#222]'         },
}

const GST_RATE = 0.18

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ViewBillingModal({ admission, onClose }) {
  const { user } = useAuth()
  const { notify } = useNotification()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!user?.hospitalId || !admission.patientId) return
    setLoading(true)

    const admitMs = new Date(admission.admissionDate).getTime()
    const daysStayed = Math.max(1, Math.ceil((Date.now() - admitMs) / (1000 * 60 * 60 * 24)))

    Promise.all([
      invoiceApi.getSmartSuggestions(admission.patientId, admission.id).catch(() => ({})),
      hospitalServiceApi.list(user.hospitalId).catch(() => []),
      admissionApi.get(admission.id).catch(() => null),
      radiologyApi.getByAdmission(admission.id).catch(() => []),
      patientServicesApi.list(user.hospitalId).catch(() => []),
    ])
      .then(([suggestions, services, fullAdmission, radiologyOrders, patientServices]) => {
        let key = 0
        const auto = []

        // Room charge
        const roomNumber = admission.roomNumber || fullAdmission?.roomNumber
        if (roomNumber) {
          const pricePerDay =
            suggestions.roomCharge?.pricePerDay ||
            fullAdmission?.roomPricePerDay ||
            fullAdmission?.room?.pricePerDay ||
            fullAdmission?.room?.dailyCharge ||
            fullAdmission?.ward?.dailyCharge ||
            0
          const roomType = admission.roomType || fullAdmission?.roomType
          const roomLabel = roomType
            ? `Room ${roomNumber} (${roomType.replace(/_/g, ' ')})`
            : `Room ${roomNumber}`
          auto.push({
            key: key++,
            itemType: 'ROOM_CHARGE',
            description: `${roomLabel} — ${daysStayed} day${daysStayed !== 1 ? 's' : ''}`,
            quantity: daysStayed,
            unitPrice: pricePerDay,
            totalPrice: daysStayed * pricePerDay,
          })
        }

        // Consultations
        suggestions.appointments?.forEach(a => {
          auto.push({
            key: key++,
            itemType: 'CONSULTATION',
            description: `Consultation — Dr. ${a.doctorName}${a.specialization ? ` (${a.specialization})` : ''}`,
            quantity: 1,
            unitPrice: a.consultationFee,
            totalPrice: a.consultationFee,
          })
        })

        // Radiology — scoped to this admission only
        const EXCLUDED_STATUSES = ['CANCELLED', 'BILLED']
        const pending = Array.isArray(radiologyOrders)
          ? radiologyOrders.filter(r => !EXCLUDED_STATUSES.includes(r.status))
          : []
        pending.forEach(r => {
          const name = r.serviceName || r.investigationName || r.testName || 'Radiology'
          const match = services.find(s => s.name.toLowerCase() === name.toLowerCase())
          const price = match?.price ?? 0
          auto.push({
            key: key++,
            itemType: 'RADIOLOGY',
            description: name,
            quantity: 1,
            unitPrice: price,
            totalPrice: price,
          })
        })

        // Patient services
        const enabledServices = Array.isArray(patientServices)
          ? patientServices.filter(s => s.isActive)
          : []
        enabledServices.forEach(s => {
          if (s.type === 'FOOD') {
            const price = s.pricePerMeal || 0
            const quantity = daysStayed * 3
            auto.push({
              key: key++,
              itemType: 'CUSTOM',
              description: `${s.name} (${daysStayed} day${daysStayed !== 1 ? 's' : ''} × 3 meals)`,
              quantity,
              unitPrice: price,
              totalPrice: quantity * price,
            })
          } else {
            const price = s.pricePerDay || 0
            auto.push({
              key: key++,
              itemType: 'CUSTOM',
              description: `${s.name} (${daysStayed} day${daysStayed !== 1 ? 's' : ''})`,
              quantity: daysStayed,
              unitPrice: price,
              totalPrice: daysStayed * price,
            })
          }
        })

        setItems(auto)
      })
      .catch(() => notify('Could not load billing details', 'error'))
      .finally(() => setLoading(false))
  }, [admission.id, user?.hospitalId])

  const subtotal = useMemo(() => items.reduce((s, i) => s + (i.totalPrice || 0), 0), [items])
  const medicineSubtotal = useMemo(
    () => items.filter(i => i.itemType === 'MEDICINE').reduce((s, i) => s + (i.totalPrice || 0), 0),
    [items]
  )
  const gst = medicineSubtotal * GST_RATE
  const grandTotal = subtotal + gst

  const hasZeroPrice = items.some(i => Number(i.unitPrice) === 0 && i.itemType !== 'CUSTOM')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] rounded-lg shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-[#2a2a2a] flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#1e1e1e] shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-500" /> Billing Details
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#888] mt-0.5">
              {admission.patientName} · {admission.admissionNumber}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222] text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-900 dark:text-white" />
              <p className="text-sm font-medium text-slate-600 dark:text-[#888]">Detecting pending charges…</p>
            </div>
          ) : (
            <>
              <div>
                <div className="mb-3">
                  <p className="text-xs font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">
                    Pending Charges
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-[#666] mt-0.5">
                    All charges auto-detected based on services used during this admission
                  </p>
                </div>

                {items.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-[#2a2a2a] rounded-lg">
                    <p className="text-sm font-medium text-slate-500 dark:text-[#777]">No charges detected</p>
                    <p className="text-xs text-slate-400 dark:text-[#555] mt-1">Charges will appear here once services are recorded</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-[#222] rounded-lg overflow-hidden">
                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 dark:bg-[#0f0f0f] border-b border-slate-100 dark:border-[#1a1a1a]">
                      {[
                        ['Type', 'col-span-2'],
                        ['Description', 'col-span-4'],
                        ['Qty', 'col-span-2 text-center'],
                        ['Unit ₹', 'col-span-2 text-right'],
                        ['Total', 'col-span-2 text-right'],
                      ].map(([h, cls]) => (
                        <div key={h} className={`text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#666] ${cls}`}>
                          {h}
                        </div>
                      ))}
                    </div>

                    <div className="divide-y divide-slate-50 dark:divide-[#1a1a1a]">
                      {items.map(item => {
                        const meta = TYPE_META[item.itemType] ?? TYPE_META.CUSTOM
                        const Icon = meta.icon
                        return (
                          <div key={item.key} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 hover:bg-slate-50/50 dark:hover:bg-[#151515] transition-colors">
                            <div className="col-span-2">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${meta.bg} ${meta.color}`}>
                                <Icon className="w-3 h-3 shrink-0" />
                                {meta.label}
                              </span>
                            </div>
                            <div className="col-span-4 text-sm text-slate-700 dark:text-[#ccc] truncate" title={item.description}>
                              {item.description}
                            </div>
                            <div className="col-span-2 text-sm text-slate-600 dark:text-[#999] text-center tabular-nums">
                              {item.quantity}
                            </div>
                            <div className="col-span-2 text-sm text-slate-600 dark:text-[#999] text-right tabular-nums">
                              {fmt(item.unitPrice)}
                            </div>
                            <div className="col-span-2 text-sm font-bold text-slate-800 dark:text-white text-right tabular-nums">
                              {fmt(item.totalPrice)}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Totals */}
                    <div className="px-4 py-4 border-t border-slate-100 dark:border-[#1a1a1a] flex justify-end bg-slate-50/50 dark:bg-[#0a0a0a]">
                      <div className="w-56 space-y-2 text-sm">
                        <div className="flex justify-between text-slate-500 dark:text-[#888]">
                          <span>Subtotal</span>
                          <span className="font-semibold tabular-nums">{fmt(subtotal)}</span>
                        </div>
                        {medicineSubtotal > 0 && (
                          <div className="flex justify-between text-slate-500 dark:text-[#888]">
                            <span>GST on medicines (18%)</span>
                            <span className="tabular-nums">{fmt(gst)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-slate-900 dark:text-white text-base border-t border-slate-100 dark:border-[#1a1a1a] pt-2.5 mt-1">
                          <span>Estimated Total</span>
                          <span className="text-blue-600 dark:text-blue-400 tabular-nums">{fmt(grandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {hasZeroPrice && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Some items have ₹0 — prices are auto-looked up from the service catalog.
                    Add the service in Settings → Packages if missing.
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 dark:text-[#555] text-center">
                This is an estimated bill based on services used so far. Final amount may vary at discharge.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-[#1e1e1e] bg-slate-50 dark:bg-[#0a0a0a] rounded-b-lg">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  )
}
