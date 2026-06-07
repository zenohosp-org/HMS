import os
import re
from collections import defaultdict

def extract_classes(filepath):
    classes = set()
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            # Find class selectors like .class-name { or .class-name:hover
            matches = re.findall(r'\.([a-zA-Z0-9_-]+)[^\{]*\{', content)
            for match in matches:
                classes.add(match)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    return classes

shell_classes = extract_classes('src/styles/modules/shell.css')
layout_classes = extract_classes('src/styles/ui/layout.css')

common = shell_classes.intersection(layout_classes)
print(f"Common classes between shell.css and layout.css: {len(common)}")
for cls in sorted(common):
    print(f"  {cls}")

