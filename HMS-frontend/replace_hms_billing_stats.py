import os

files = [
    'src/pages/billing/IPDBilling.jsx',
    'src/pages/billing/AmbulanceBilling.jsx',
    'src/pages/billing/OPDBilling.jsx'
]

for filepath in files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        content = content.replace('className="hms-billing-stats"', 'className="zu-stat-card-grid"')
        
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")
    except Exception as e:
        print(f"Error {filepath}: {e}")

