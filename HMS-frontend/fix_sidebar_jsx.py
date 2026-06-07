import re

with open('src/components/layout/Sidebar.jsx', 'r') as f:
    code = f.read()

# Replace all zu-sidebar- with sidebar-
code = code.replace('zu-sidebar-', 'sidebar-')
code = code.replace('zu-sidebar', 'sidebar')

# Replace renderLink
old_render_link = """    const renderLink = (link, isSubmenu = false) => {
        const Icon = link.icon;
        
        if (isSubmenu) {
            return (
                <li key={link.to}>
                    <NavLink
                        to={link.to}
                        end
                        title={!isOpen ? link.label : undefined}
                        className={({ isActive }) => isActive ? "active" : ""}
                    >
                        {link.label}
                    </NavLink>
                </li>
            );
        }

        return (
            <div className="sidebar-nav-group" key={link.to}>
                <NavLink
                    to={link.to}
                    end
                    title={!isOpen ? link.label : undefined}
                    className={({ isActive }) => `sidebar-nav-item${!isOpen ? " is-icon-only" : ""}${isActive ? " active" : ""}`}
                >
                    <Icon className="sidebar-nav-icon" />
                    {isOpen && <div className="sidebar-nav-label">{link.label}</div>}
                </NavLink>
            </div>
        );
    };"""

new_render_link = """    const renderLink = (link, isSubmenu = false) => {
        const Icon = link.icon;
        const isActiveLink = location.pathname.startsWith(link.to);
        
        if (isSubmenu) {
            return (
                <li key={link.to}>
                    <button
                        onClick={() => navigate(link.to)}
                        title={!isOpen ? link.label : undefined}
                        className={isActiveLink ? "active" : ""}
                    >
                        {link.label}
                    </button>
                </li>
            );
        }

        return (
            <div className="sidebar-nav-group" key={link.to}>
                <button
                    onClick={() => navigate(link.to)}
                    title={!isOpen ? link.label : undefined}
                    className={`sidebar-nav-item${!isOpen ? " is-icon-only" : ""}${isActiveLink ? " active" : ""}`}
                >
                    <div className="sidebar-nav-label">
                        <Icon className="sidebar-nav-icon" />
                        {isOpen && <span>{link.label}</span>}
                    </div>
                </button>
            </div>
        );
    };"""
code = code.replace(old_render_link, new_render_link)

# Replace renderAccordionSection
old_accordion = """    const renderAccordionSection = (links, label, AccIcon, open, setOpen, active) => {
        if (!isOpen) return links.map((link) => renderLink(link));
        return (
            <div className="sidebar-nav-group" key={label}>
                <button
                    onClick={() => setOpen((o) => !o)}
                    className={`sidebar-nav-item has-submenu${active ? " active" : ""}`}
                >
                    <AccIcon className="sidebar-nav-icon" />
                    <div className="sidebar-nav-label">{label}</div>
                    <ChevronDown
                        size={15}
                        className={`sidebar-nav-chevron${open ? " is-open" : ""}`}
                    />
                </button>
                {open && (
                    <ul className="sidebar-submenu">
                        {links.map((link) => renderLink(link, true))}
                    </ul>
                )}
            </div>
        );
    };"""

new_accordion = """    const renderAccordionSection = (links, label, AccIcon, open, setOpen, active) => {
        if (!isOpen) return links.map((link) => renderLink(link));
        return (
            <div className="sidebar-nav-group" key={label}>
                <button
                    onClick={() => setOpen((o) => !o)}
                    className={`sidebar-nav-item has-submenu${active ? " active" : ""}`}
                >
                    <div className="sidebar-nav-label">
                        <AccIcon className="sidebar-nav-icon" />
                        <span>{label}</span>
                    </div>
                    <ChevronDown
                        size={15}
                        className={`sidebar-nav-chevron${open ? " is-open" : ""}`}
                    />
                </button>
                {open && (
                    <ul className="sidebar-submenu">
                        {links.map((link) => renderLink(link, true))}
                    </ul>
                )}
            </div>
        );
    };"""
code = code.replace(old_accordion, new_accordion)

# Need to inject useNavigate into Sidebar component since we are using button now
if 'const navigate = useNavigate();' not in code:
    code = code.replace('const location = useLocation();', 'const location = useLocation();\n    const navigate = useNavigate();')
    code = code.replace('import { NavLink, useLocation } from "react-router-dom";', 'import { NavLink, useLocation, useNavigate } from "react-router-dom";')


# Also fix renderExternalApp to match Div > SVG & Span
old_ext_1 = """            <a
                key={app.href}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                className={baseCls}
            >
                <Icon className="sidebar-nav-icon" />
                <span className="sidebar-nav-label">{app.label}</span>
            </a>"""
new_ext_1 = """            <a
                key={app.href}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                className={baseCls}
            >
                <div className="sidebar-nav-label">
                    <Icon className="sidebar-nav-icon" />
                    <span>{app.label}</span>
                </div>
            </a>"""
code = code.replace(old_ext_1, new_ext_1)

with open('src/components/layout/Sidebar.jsx', 'w') as f:
    f.write(code)
