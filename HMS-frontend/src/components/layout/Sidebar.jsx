import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useFeatureFlag } from "@/context/FeatureFlagsContext";
import {
    Home,
    Users,
    Building2,
    ClipboardList,
    ReceiptText,
    Activity,
    Bed,
    BedDouble,
    Calendar,
    Stethoscope,
    BookOpen,
    Boxes,
    BarChart2,
    LayoutGrid,
    ChevronDown,
    UserSquare2,
    CalendarDays,
    FlaskConical,
    Award,
    Ambulance,
    HeartPulse,
    Settings,
    ConciergeBell,
} from "lucide-react";

const DASHBOARD_LINK = { label: "Dashboard", to: "/dashboard", icon: Home };
const CLINICAL_LINKS = [
    { label: "Doctors", to: "/doctors", icon: Users },
    { label: "Patients", to: "/patients", icon: Building2 },
    { label: "Appointments", to: "/appointments", icon: Calendar },
];
const ADMIN_LINKS = [
    { label: "Specializations", to: "/specializations", icon: Stethoscope },
    { label: "Services", to: "/services", icon: ClipboardList },
];
const SETTINGS_LINKS = [
    { label: "General Settings", to: "/settings/general", icon: Settings },
    { label: "Infrastructure", to: "/settings/infrastructure", icon: Building2 },
    { label: "Patient Services", to: "/settings/patient-services", icon: ConciergeBell },
    { label: "Packages", to: "/checkups/packages", icon: ClipboardList },
];
const ROOMS_LINKS = [
    { label: "IPD Admission", to: "/admissions", icon: BedDouble },
    { label: "Rooms and Allocations", to: "/rooms/allocation", icon: Bed },
    { label: "Logs", to: "/rooms/logs", icon: ClipboardList },
];
const AMBULANCE_LINKS = [
    { label: "Book", to: "/ambulance/book", icon: Ambulance },
    { label: "Status", to: "/ambulance/status", icon: Activity },
];
const CHECKUP_LINK = { label: "Health Checkups", to: "/checkups/bookings", icon: HeartPulse };
const HR_LINKS = [
    { label: "Staff Directory", to: "/staffs/directory", icon: UserSquare2 },
    { label: "Shift Roster", to: "/staffs/roster", icon: CalendarDays },
    { label: "Departments", to: "/staffs/departments", icon: Building2 },
    { label: "Designations", to: "/staffs/designations", icon: Award },
];
const BILLING_LINKS = [
    { label: "OPD Billing", to: "/billing/opd", icon: ReceiptText },
    { label: "IPD Billing", to: "/billing/ipd", icon: ReceiptText },
    { label: "Ambulance Billing", to: "/billing/ambulance", icon: Ambulance },
];
const EXTERNAL_APPS = [
    { label: "Labs", href: "https://labs.zenohosp.com", icon: FlaskConical },
    { label: "Finance", href: "https://finance.zenohosp.com", icon: BarChart2 },
    { label: "Inventory", href: "https://inventory.zenohosp.com", icon: Boxes },
    { label: "Directory", href: "https://directory.zenohosp.com", icon: BookOpen },
    { label: "Assets", href: "https://asset.zenohosp.com", icon: LayoutGrid },
];

function Sidebar({ isOpen }) {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const ambulanceEnabled = useFeatureFlag("AMBULANCE");
    const checkupsEnabled = useFeatureFlag("HEALTH_CHECKUPS");
    const ipdEnabled = useFeatureFlag("IPD");
    const [hrOpen, setHrOpen] = useState(() => location.pathname.startsWith("/staffs"));
    const [roomsOpen, setRoomsOpen] = useState(
        () => location.pathname.startsWith("/rooms") || location.pathname.startsWith("/admissions")
    );
    const [ambOpen, setAmbOpen] = useState(() => location.pathname.startsWith("/ambulance"));
    const [settingsOpen, setSettingsOpen] = useState(
        () =>
            location.pathname.startsWith("/settings") ||
            location.pathname.startsWith("/checkups/packages") ||
            location.pathname.startsWith("/settings/patient-services")
    );
    const [billingOpen, setBillingOpen] = useState(() => location.pathname.startsWith("/billing"));

    const filteredClinicalLinks = CLINICAL_LINKS.filter((link) => {
        if (user?.role === "hospital_admin" || user?.role === "super_admin") return true;
        const allowedLinks = ["Patients", "Appointments"];
        return allowedLinks.includes(link.label);
    });
    const filteredAdminLinks = ADMIN_LINKS.filter((link) => {
        if (user?.role === "hospital_admin" || user?.role === "super_admin") return true;
        const allowedLinks = ["Billing"];
        return allowedLinks.includes(link.label);
    });
    const isHrAdmin = user?.role === "hospital_admin" || user?.role === "super_admin";
    const hrActive = location.pathname.startsWith("/staffs");
    const roomsActive =
        location.pathname.startsWith("/rooms") || location.pathname.startsWith("/admissions");
    const ambActive = location.pathname.startsWith("/ambulance");
    const settingsActive =
        location.pathname.startsWith("/settings") ||
        location.pathname.startsWith("/checkups/packages") ||
        location.pathname.startsWith("/settings/patient-services");
    const billingActive = location.pathname.startsWith("/billing");
    const visibleBillingLinks = BILLING_LINKS.filter(
        (link) => ambulanceEnabled || link.to !== "/billing/ambulance"
    );

    const renderLink = (link, isSubmenu = false) => {
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
    };

    const renderExternalApp = (app) => {
        const Icon = app.icon;
        const baseCls = `sidebar-ext${isOpen ? "" : " is-icon-only"}`;
        return isOpen ? (
            <a
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
            </a>
        ) : (
            <a
                key={app.href}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                title={app.label}
                className={baseCls}
            >
                <Icon className="sidebar-nav-icon" />
            </a>
        );
    };

    const renderAccordionSection = (links, label, AccIcon, open, setOpen, active) => {
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
    };

    return (
        <aside className={`sidebar${isOpen ? "" : " is-collapsed"}`}>
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <Activity className="w-4 h-4" />
                </div>
                {isOpen && (
                    <div className="sidebar-brand">
                        <p className="sidebar-brand-name">ZenoHosp</p>
                        <p className="sidebar-brand-sub">{user?.hospitalName}</p>
                    </div>
                )}
            </div>

            <nav className="sidebar-nav-container">
                {renderLink(DASHBOARD_LINK)}


                {filteredClinicalLinks.map((link) => renderLink(link))}
                {ipdEnabled &&
                    renderAccordionSection(
                        ROOMS_LINKS,
                        "IPD Management",
                        BedDouble,
                        roomsOpen,
                        setRoomsOpen,
                        roomsActive
                    )}
                {ambulanceEnabled &&
                    renderAccordionSection(
                        AMBULANCE_LINKS,
                        "Ambulance",
                        Ambulance,
                        ambOpen,
                        setAmbOpen,
                        ambActive
                    )}
                {checkupsEnabled && renderLink(CHECKUP_LINK)}
                {renderAccordionSection(
                    visibleBillingLinks,
                    "Billing",
                    ReceiptText,
                    billingOpen,
                    setBillingOpen,
                    billingActive
                )}
                {filteredAdminLinks.map((link) => renderLink(link))}
                {isHrAdmin &&
                    renderAccordionSection(
                        HR_LINKS,
                        "HR & Staff",
                        ClipboardList,
                        hrOpen,
                        setHrOpen,
                        hrActive
                    )}
                {isHrAdmin &&
                    renderAccordionSection(
                        SETTINGS_LINKS,
                        "Settings",
                        Settings,
                        settingsOpen,
                        setSettingsOpen,
                        settingsActive
                    )}
            </nav>

            <div className="sidebar-footer">
                {isOpen && (
                    <div className="sidebar-section-label">Other Apps</div>
                )}
                {EXTERNAL_APPS.map((app) => renderExternalApp(app))}
            </div>
        </aside>
    );
}

export { Sidebar as default };
