import glob
import re

module_css_files = glob.glob('src/styles/modules/*.css')

# Regex to match .is-something { ... } (including multiline and properties)
# We will match: .is-[a-z-]+, maybe pseudo-classes, followed by { ... }
pattern = re.compile(r'\.is-[a-z-]+(?:\:[a-z-]+)?\s*\{[^}]*\}', re.DOTALL)

for filepath in module_css_files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            
        new_content = pattern.sub('', content)
        
        if content != new_content:
            print(f"Removed duplicates in {filepath}")
            with open(filepath, 'w') as f:
                f.write(new_content)
    except Exception as e:
        print(f"Error {filepath}: {e}")

