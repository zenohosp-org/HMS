import os
import re

directories_to_search = [
    "src/pages",
    "src/components",
    "src/styles",
]

for root_dir in directories_to_search:
    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            if not filename.endswith(('.jsx', '.css')):
                continue
                
            filepath = os.path.join(dirpath, filename)
            with open(filepath, 'r') as f:
                content = f.read()
                
            original_content = content
            
            if filename.endswith('.jsx'):
                # Replace hms-billing-spin with zu-spinner
                content = content.replace('hms-billing-spin', 'zu-spinner')
                # Replace animate-spin with zu-spinner
                content = content.replace('animate-spin', 'zu-spinner')
                
                # We won't rename <Loader2> to <Spinner> yet, we will just fix the classes
                # since zu-spinner is globally defined in components.css!
                
            if content != original_content:
                with open(filepath, 'w') as f:
                    f.write(content)
                print(f"Updated {filepath}")

