import re

with open('src/styles/ui/layout.css', 'r') as f:
    css = f.read()

# Modify .sidebar-nav-item
css = re.sub(
    r'\.sidebar-nav-item \{[\s\S]*?\}',
    '''.sidebar-nav-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--zu-space-9) var(--zu-space-md);
    margin: 0 0 2px var(--zu-space-12);
    width: calc(100% - 1.5rem);
    border-radius: 0.5rem;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    color: var(--zu-gray-600);
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: var(--zu-font-family);
    transition: background var(--zu-transition-fast), color var(--zu-transition-fast);
    text-align: left;
}''',
    css,
    count=1
)

# Modify hover
css = re.sub(
    r'\.sidebar-nav-item:hover \{[\s\S]*?\}',
    '''.sidebar-nav-item:hover {
    background: var(--zu-gray-100);
    color: var(--zu-slate-900);
}''',
    css,
    count=1
)

# Modify active
css = re.sub(
    r'\.sidebar-nav-item\.active \{[\s\S]*?\}',
    '''.sidebar-nav-item.active {
    background: var(--zu-gray-100);
    color: var(--zu-slate-900);
    font-weight: 700;
}''',
    css,
    count=1
)

# Modify .sidebar-nav-icon
css = re.sub(
    r'\.sidebar-nav-icon \{[\s\S]*?\}',
    '''.sidebar-nav-icon {
    width: 18px;
    height: 18px;
    color: currentColor;
    flex-shrink: 0;
}''',
    css,
    count=1
)

# Modify .sidebar-submenu
css = re.sub(
    r'\.sidebar-submenu \{[\s\S]*?\}',
    '''.sidebar-submenu {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 0 0 1rem;
    margin: 2px 0.75rem 2px 28px;
    border-left: 2px solid var(--zu-gray-200);
}''',
    css,
    count=1
)

# Replace all .sidebar-submenu a with .sidebar-submenu button
css = css.replace('.sidebar-submenu a', '.sidebar-submenu button')

# Modify .sidebar-submenu button
css = re.sub(
    r'\.sidebar-submenu button \{[\s\S]*?\}',
    '''.sidebar-submenu button {
    display: block;
    font-size: 14px;
    font-weight: 500;
    padding: 8px 1rem;
    border-radius: 0.5rem;
    width: 100%;
    text-align: left;
    text-decoration: none;
    color: var(--zu-gray-600);
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: var(--zu-font-family);
    transition: background var(--zu-transition-fast), color var(--zu-transition-fast);
}''',
    css,
    count=1
)

# Modify hover
css = re.sub(
    r'\.sidebar-submenu button:hover \{[\s\S]*?\}',
    '''.sidebar-submenu button:hover {
    background: var(--zu-gray-100);
    color: var(--zu-slate-900);
}''',
    css,
    count=1
)

# Modify active
css = re.sub(
    r'\.sidebar-submenu button\.active \{[\s\S]*?\}',
    '''.sidebar-submenu button.active {
    background: var(--zu-gray-100);
    color: var(--zu-slate-900);
    font-weight: 600;
}''',
    css,
    count=1
)


with open('src/styles/ui/layout.css', 'w') as f:
    f.write(css)
