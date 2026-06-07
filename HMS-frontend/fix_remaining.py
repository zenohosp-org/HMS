import os

files = [
    'src/pages/admin/Admissions.jsx',
    'src/pages/ipd/InfrastructureMapping.jsx',
    'src/pages/admin/DoctorDetails.jsx'
]

for filepath in files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        # In Admissions.jsx
        content = content.replace('className="zu-stat-card-card"', 'className="is-stat"')
        
        # In InfrastructureMapping.jsx (might use zu-stat-card-val? Let's check)
        content = content.replace('className="zu-stat-card"', 'className="zu-card is-stat"')
        content = content.replace('className={`zu-stat-card ', 'className={`zu-card is-stat ')

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")
    except Exception as e:
        print(f"Error {filepath}: {e}")
