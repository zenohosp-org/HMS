import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
    ArrowUpRight,
    BookOpen,
    Boxes,
    BarChart2,
    LayoutGrid,
    ChevronDown,
    UserSquare2,
    CalendarDays,
    ScanLine,
    FileText,
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
    { label: "Room Allocation", to: "/rooms/allocation", icon: Bed },
    { label: "Room Logs", to: "/rooms/logs", icon: ClipboardList },
    { label: "IPD Admissions", to: "/admissions", icon: BedDouble },
];
const AMBULANCE_LINKS = [
    { label: "Book", to: "/ambulance/book", icon: Ambulance },
    { label: "Status", to: "/ambulance/status", icon: Activity },
];
const CHECKUP_LINK = { label: "Health Checkups", to: "/checkups/bookings", icon: HeartPulse };
const RADIOLOGY_LINKS = [
    { label: "Imaging Queue", to: "/radiology/imaging-queue", icon: ScanLine },
    { label: "Reports", to: "/radiology/reports", icon: FileText },
];
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
    { label: "Finance", href: "https://finance.zenohosp.com", icon: BarChart2 },
    { label: "Inventory", href: "https://inventory.zenohosp.com", icon: Boxes },
    { label: "Directory", href: "https://directory.zenohosp.com", icon: BookOpen },
    { label: "Assets", href: "https://asset.zenohosp.com", icon: LayoutGrid },
];

function Sidebar({ isOpen }) {
    const { user } = useAuth();
    const location = useLocation();
    const ambulanceEnabled = useFeatureFlag("AMBULANCE");
    const radiologyEnabled = useFeatureFlag("RADIOLOGY");
    const checkupsEnabled = useFeatureFlag("HEALTH_CHECKUPS");
    const ipdEnabled = useFeatureFlag("IPD");
    const [hrOpen, setHrOpen] = useState(() => location.pathname.startsWith("/staffs"));
    const [radOpen, setRadOpen] = useState(() => location.pathname.startsWith("/radiology"));
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
    const radActive = location.pathname.startsWith("/radiology");
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

    const renderLink = (link, indent = false) => {
        const Icon = link.icon;
        const baseCls = `hms-sidebar__link${indent ? " is-indent" : ""}${
            isOpen ? "" : " is-icon-only"
        }`;
        return isOpen ? (
            <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) => `${baseCls}${isActive ? " is-active" : ""}`}
            >
                <Icon className="hms-sidebar__link-icon" />
                <span className="hms-sidebar__link-label">{link.label}</span>
            </NavLink>
        ) : (
            <NavLink
                key={link.to}
                to={link.to}
                end
                title={link.label}
                className={({ isActive }) => `${baseCls}${isActive ? " is-active" : ""}`}
            >
                <Icon className="hms-sidebar__link-icon" />
            </NavLink>
        );
    };

    const renderExternalApp = (app) => {
        const Icon = app.icon;
        const baseCls = `hms-sidebar__ext${isOpen ? "" : " is-icon-only"}`;
        return isOpen ? (
            <a
                key={app.href}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                className={baseCls}
            >
                <Icon className="hms-sidebar__link-icon" />
                <span className="hms-sidebar__link-label">{app.label}</span>
                <ArrowUpRight className="hms-sidebar__ext-arrow" />
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
                <Icon className="hms-sidebar__link-icon" />
            </a>
        );
    };

    const renderAccordionSection = (links, label, AccIcon, open, setOpen, active) => {
        if (!isOpen) return links.map((link) => renderLink(link));
        return (
            <div>
                <button
                    onClick={() => setOpen((o) => !o)}
                    className={`hms-sidebar__acc-btn${active ? " is-active" : ""}`}
                >
                    <AccIcon className="hms-sidebar__link-icon" />
                    <span className="hms-sidebar__link-label">{label}</span>
                    <ChevronDown
                        className={`hms-sidebar__acc-chevron${open ? " is-open" : ""}`}
                    />
                </button>
                {open && (
                    <div className="hms-sidebar__acc-body">
                        {links.map((link) => renderLink(link, true))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside className={`hms-sidebar${isOpen ? "" : " is-collapsed"}`}>
            <div className="hms-sidebar__logo">
                <div className="hms-sidebar__logo-icon">
                    <Activity className="w-4 h-4" />
                </div>
                {isOpen && (
                    <div className="hms-sidebar__brand">
                        <p className="hms-sidebar__brand-name">ZenoHosp</p>
                        <p className="hms-sidebar__brand-sub">{user?.hospitalName}</p>
                    </div>
                )}
            </div>

            <nav className="hms-sidebar__nav">
                {isOpen && (
                    <div className="hms-sidebar__section-label">Main Menu</div>
                )}
                {renderLink(DASHBOARD_LINK)}

                {isOpen && (
                    <div className="hms-sidebar__section-label is-spaced">Hospital</div>
                )}
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
                {radiologyEnabled &&
                    renderAccordionSection(
                        RADIOLOGY_LINKS,
                        "Radiology",
                        ScanLine,
                        radOpen,
                        setRadOpen,
                        radActive
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

            <div className="hms-sidebar__footer">
                {isOpen && (
                    <div className="hms-sidebar__section-label">Other Apps</div>
                )}
                {EXTERNAL_APPS.map((app) => renderExternalApp(app))}
            </div>
        </aside>
    );
}

export { Sidebar as default };
