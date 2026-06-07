import os
import re

files = [
    'src/pages/checkups/CheckupBookings.jsx',
    'src/pages/radiology/RadiologyQueue.jsx',
    'src/pages/admin/Admissions.jsx',
    'src/pages/ipd/InfrastructureMapping.jsx',
]

for filepath in files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        # 1. In CheckupBookings.jsx:
        if 'CheckupBookings.jsx' in filepath:
            # Change value first, then label to label first, then value
            content = content.replace(
"""            <div>
              <p className="zu-stat-card-value">{s.value}</p>
              <p className="zu-stat-card-label">{s.label}</p>
            </div>""",
"""            <div className="zu-stat-card-body">
              <p className="zu-stat-card-label">{s.label}</p>
              <p className="zu-stat-card-value">{s.value}</p>
            </div>""")

        # 2. In RadiologyQueue.jsx:
        if 'RadiologyQueue.jsx' in filepath:
            # Currently:
            # <div className="zu-card is-stat is-amber">
            #   <div>
            #     <p className="zu-stat-card-label">Pending Scans</p>
            #     <p className="zu-stat-card-value">{stats.pendingScan}</p>
            #   </div>
            #   <ScanLine className="zu-stat-card-icon" />
            # </div>
            content = content.replace(
"""        <div className="zu-card is-stat is-amber">
          <div>
            <p className="zu-stat-card-label">Pending Scans</p>
            <p className="zu-stat-card-value">{stats.pendingScan}</p>
          </div>
          <ScanLine className="zu-stat-card-icon" />
        </div>""",
"""        <div className="zu-card is-stat">
          <div className="zu-stat-card-icon is-amber">
            <ScanLine className="w-5 h-5" />
          </div>
          <div className="zu-stat-card-body">
            <p className="zu-stat-card-label">Pending Scans</p>
            <p className="zu-stat-card-value">{stats.pendingScan}</p>
          </div>
        </div>""")
            
            content = content.replace(
"""        <div className="zu-card is-stat is-slate">
          <div>
            <p className="zu-stat-card-label">Awaiting Reports</p>
            <p className="zu-stat-card-value">{stats.awaitingReport}</p>
          </div>
          <Clock className="zu-stat-card-icon" />
        </div>""",
"""        <div className="zu-card is-stat">
          <div className="zu-stat-card-icon is-slate">
            <Clock className="w-5 h-5" />
          </div>
          <div className="zu-stat-card-body">
            <p className="zu-stat-card-label">Awaiting Reports</p>
            <p className="zu-stat-card-value">{stats.awaitingReport}</p>
          </div>
        </div>""")

            content = content.replace(
"""        <div className="zu-card is-stat is-emerald">
          <div>
            <p className="zu-stat-card-label">Completed Today</p>
            <p className="zu-stat-card-value">{stats.reportGenerated}</p>
          </div>
          <CheckCircle2 className="zu-stat-card-icon" />
        </div>""",
"""        <div className="zu-card is-stat">
          <div className="zu-stat-card-icon is-emerald">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="zu-stat-card-body">
            <p className="zu-stat-card-label">Completed Today</p>
            <p className="zu-stat-card-value">{stats.reportGenerated}</p>
          </div>
        </div>""")

        # 3. In Admissions.jsx:
        if 'Admissions.jsx' in filepath:
            content = content.replace(
"""                            <div>
                                <p className="zu-stat-card-value">{value}</p>
                                <p className="zu-stat-card-label">{label}</p>
                            </div>""",
"""                            <div className="zu-stat-card-body">
                                <p className="zu-stat-card-label">{label}</p>
                                <p className="zu-stat-card-value">{value}</p>
                            </div>""")

        # 4. In InfrastructureMapping.jsx
        if 'InfrastructureMapping.jsx' in filepath:
            content = content.replace(
"""            <div>
              <p className="zu-stat-card-value">{s.value}</p>
              <p className="zu-stat-card-label">{s.label}</p>
            </div>""",
"""            <div className="zu-stat-card-body">
              <p className="zu-stat-card-label">{s.label}</p>
              <p className="zu-stat-card-value">{s.value}</p>
            </div>""")

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")
    except Exception as e:
        print(f"Error {filepath}: {e}")
