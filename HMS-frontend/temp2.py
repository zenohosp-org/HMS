import re

with open(r'c:\Users\Karthikeyan M\Desktop\zenohosp-HMS\HMS-frontend\src\pages\appointments\AppointmentsDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the button rendering to look like the screenshot
# The screenshot has:
# Actions (Header)
# View details
# Edit appointment
# Reschedule
# ✓ Mark as in progress (with grey bg)
# ---
# Cancel appointment (red)

old_buttons_block = '''{actions.map(action => (
                                <button
                                    key={action.status}
                                    onClick={() => handleAction(action.status)}
                                    className={w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors text-left }
                                >
                                    {iconFor(action.icon)}
                                    {action.label}
                                </button>
                            ))}'''

new_buttons_block = '''{/* Static action links */}
                            <button className="w-full text-left flex items-center px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors">
                                View details
                            </button>
                            <button className="w-full text-left flex items-center px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors">
                                Edit appointment
                            </button>
                            <button className="w-full text-left flex items-center px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#222222] transition-colors">
                                Reschedule
                            </button>

                            {/* Status transitions */}
                            {actions.filter(a => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW').map(action => (
                                <button
                                    key={action.status}
                                    onClick={() => handleAction(action.status)}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-[14px] font-medium text-slate-800 dark:text-slate-200 bg-slate-50/80 dark:bg-[#1a1a1a] hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors text-left"
                                >
                                    <CheckCircle2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                                    {action.label}
                                </button>
                            ))}
                            
                            {/* Danger actions (Cancel/No Show) */}
                            {actions.some(a => a.status === 'CANCELLED' || a.status === 'NO_SHOW') && (
                                <>
                                    <div className="h-px bg-slate-100 dark:bg-[#2a2a2a] my-1 mx-4"></div>
                                    {actions.filter(a => a.status === 'CANCELLED' || a.status === 'NO_SHOW').map(action => (
                                        <button
                                            key={action.status}
                                            onClick={() => handleAction(action.status)}
                                            className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </>
                            )}'''

content = content.replace(old_buttons_block, new_buttons_block)

# Make sure width and header are correct
content = content.replace(
    '''<div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-xl shadow-xl z-30 overflow-hidden">''',
    '''<div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#222222] rounded-xl shadow-lg z-30 overflow-hidden py-1">'''
)

content = content.replace(
    '''<div className="px-3 py-3 border-b border-slate-100 dark:border-[#252525]">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#888888] ml-1">ACTIONS</p>
                    </div>''',
    '''<div className="px-4 py-2 mb-1">
                        <p className="text-[15px] font-bold text-slate-900 dark:text-white">Actions</p>
                    </div>'''
)

with open(r'c:\Users\Karthikeyan M\Desktop\zenohosp-HMS\HMS-frontend\src\pages\appointments\AppointmentsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
