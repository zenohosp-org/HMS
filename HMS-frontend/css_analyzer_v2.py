import os
import re
import glob

# Find all CSS files
css_files = glob.glob('src/**/*.css', recursive=True)
jsx_files = glob.glob('src/**/*.jsx', recursive=True)

class_definitions = {} # class_name -> set of files where defined
class_usage = set()    # class_name -> used somewhere

# Extract defined classes
for css_file in css_files:
    try:
        with open(css_file, 'r') as f:
            content = f.read()
            # Remove comments to avoid false positives
            content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
            # Find class selectors (very simplified, looks for . followed by class name)
            # using lookahead/behind to ensure it's a class selector in CSS
            # We look for lines containing a dot followed by letters, hyphens, and maybe pseudo classes
            matches = re.finditer(r'\.([a-zA-Z_][a-zA-Z0-9_-]*)', content)
            for m in matches:
                cls = m.group(1)
                if cls not in class_definitions:
                    class_definitions[cls] = set()
                class_definitions[cls].add(css_file)
    except Exception as e:
        pass

# Find usage in JSX
for jsx_file in jsx_files:
    try:
        with open(jsx_file, 'r') as f:
            content = f.read()
            # Look for className="something" or className={`something`}
            # Just extract all words with hyphens and letters that might be classes
            matches = re.finditer(r'([a-zA-Z_][a-zA-Z0-9_-]*)', content)
            for m in matches:
                class_usage.add(m.group(1))
    except Exception as e:
        pass

# Find duplicates
duplicates = {cls: files for cls, files in class_definitions.items() if len(files) > 1}

# Find unused
unused = {cls for cls in class_definitions if cls not in class_usage}

print(f"Total defined classes: {len(class_definitions)}")
print(f"Total duplicate classes: {len(duplicates)}")
print(f"Total unused classes: {len(unused)}")

# Let's inspect the duplicates first
print("\n--- DUPLICATE CLASSES (defined in multiple files) ---")
for cls, files in sorted(duplicates.items()):
    # Ignore some generic names if we want, or print all
    print(f"{cls}: {', '.join(sorted(files))}")

