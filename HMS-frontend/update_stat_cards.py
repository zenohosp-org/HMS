import os
import glob

files = [
    'src/pages/Dashboard.jsx',
    'src/pages/checkups/CheckupBookings.jsx',
    'src/pages/radiology/RadiologyQueue.jsx',
    'src/pages/admin/Admissions.jsx',
    'src/pages/admin/DoctorDetails.jsx',
    'src/pages/ipd/InfrastructureMapping.jsx',
    'src/pages/billing/IPDBilling.jsx',
    'src/pages/billing/OPDBilling.jsx',
    'src/pages/billing/AmbulanceBilling.jsx'
]

for filepath in files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        new_content = content.replace('className="zu-stat-card"', 'className="zu-card is-stat"')
        new_content = new_content.replace('className={`zu-stat-card ', 'className={`zu-card is-stat ')
        
        # also handle any bare occurrences just in case, though the above usually covers it
        if content != new_content:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Updated {filepath}")
    except Exception as e:
        print(f"Error updating {filepath}: {e}")
