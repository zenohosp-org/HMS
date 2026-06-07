import re

with open('src/styles/ui/layout.css', 'r') as f:
    css = f.read()

css = css.replace('zu-sidebar', 'sidebar')

# We also need to fix the flex structure for .sidebar-nav-label
css = css.replace(
    '.sidebar-nav-label {\n    flex: 1;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}',
    '.sidebar-nav-label {\n    display: flex;\n    align-items: center;\n    gap: 0.75rem;\n    flex: 1;\n    overflow: hidden;\n}\n.sidebar-nav-label span {\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}'
)

# And remove gap from .sidebar-nav-item since .sidebar-nav-label handles it now
css = css.replace(
    '.sidebar-nav-item {\n    display: flex;\n    align-items: center;\n    gap: 0.75rem;',
    '.sidebar-nav-item {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;'
)

with open('src/styles/ui/layout.css', 'w') as f:
    f.write(css)
