import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
    currentPage: number
    totalPages: number
    totalItems: number
    pageSize: number
    onPageChange: (page: number) => void
}

export default function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }: Props) {
    if (totalPages <= 1) return null

    const from = (currentPage - 1) * pageSize + 1
    const to   = Math.min(currentPage * pageSize, totalItems)

    const pages: (number | '…')[] = []
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
        pages.push(1)
        if (currentPage > 3) pages.push('…')
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i)
        if (currentPage < totalPages - 2) pages.push('…')
        pages.push(totalPages)
    }

    return (
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100 dark:border-[#1e1e1e]">
            <p className="text-xs text-slate-400 dark:text-[#555555]">
                Showing <span className="font-semibold text-slate-600 dark:text-[#888888]">{from}–{to}</span> of <span className="font-semibold text-slate-600 dark:text-[#888888]">{totalItems}</span>
            </p>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-slate-500 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {pages.map((p, i) =>
                    p === '…' ? (
                        <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400 dark:text-[#555555]">…</span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onPageChange(p as number)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors
                                ${currentPage === p
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-transparent'
                                    : 'border border-slate-200 dark:border-[#2a2a2a] text-slate-600 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a]'
                                }`}
                        >
                            {p}
                        </button>
                    )
                )}

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-[#2a2a2a] text-slate-500 dark:text-[#888888] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
}
