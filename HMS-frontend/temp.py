import re

with open(r'c:\Users\Karthikeyan M\Desktop\zenohosp-HMS\HMS-frontend\src\pages\appointments\AppointmentsDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make the dropdown wider and simpler: w-56, rounded-lg, shadow-lg, border-slate-200
content = content.replace(
    '''<div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl shadow-xl z-30 overflow-hidden">''',
    '''<div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-lg z-30 overflow-hidden">'''
)

# Header: bold black Actions
content = content.replace(
    '''<div className="px-3 py-3 border-b border-slate-100 dark:border-[#252525]">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#888888] ml-1">ACTIONS</p>
                    </div>''',
    '''<div className="px-4 py-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Actions</p>
                    </div>'''
)

# Replace the buttons loop content
content = content.replace(
    '''{!showCancelReason ? (
                        <div className="py-1">
                            {actions.map(action => (
                                <button
                                    key={action.status}
                                    onClick={() => handleAction(action.status)}
                                    className={w-full flex items-center gap-3 px-4 py-2.5 text-[15px] font-medium hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors text-left }
                                >
                                    {iconFor(action.icon)}
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    ) : (''',
    '''{!showCancelReason ? (
                        <div className="flex flex-col pb-1">
                            {/* Non-status actions (view, edit, reschedule) */}
                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222222]">View details</button>
                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222222]">Edit appointment</button>
                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222222]">Reschedule</button>
                            
                            {/* Status actions mapped */}
                            {(actions.filter(a => a.icon !== 'cancel' && a.icon !== 'noshow')).map(action => (
                                <button
                                    key={action.status}
                                    onClick={() => handleAction(action.status)}
                                    className={w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors text-left text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-[#151515]}
                                >
                                    {action.icon === 'complete' && <CheckCircle2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
                                    {action.icon === 'progress' && <CheckCircle2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
                                    {action.icon === 'confirm' && <CheckCircle2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
                                    {action.icon === 'checkin' && <CheckCircle2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
                                    <span className={action.icon ? '' : 'ml-6'}>{action.label}</span>
                                </button>
                            ))}

                            {/* Separator and Cancel */}
                            {actions.some(a => a.icon === 'cancel') && (
                                <>
                                    <div className="h-px bg-slate-100 dark:bg-[#2a2a2a] my-1 mx-4"></div>
                                    <button
                                        onClick={() => handleAction('CANCELLED')}
                                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-slate-50 dark:hover:bg-[#222222]"
                                    >
                                        Cancel appointment
                                    </button>
                                </>
                            )}
                        </div>
                    ) : ('''
)

with open(r'c:\Users\Karthikeyan M\Desktop\zenohosp-HMS\HMS-frontend\src\pages\appointments\AppointmentsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
