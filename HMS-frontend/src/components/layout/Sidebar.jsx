import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
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
  Network
} from "lucide-react";
const DASHBOARD_LINK = { label: "Dashboard", to: "/dashboard", icon: Home };
const CLINICAL_LINKS = [
  { label: "Doctors", to: "/doctors", icon: Users },
  { label: "Patients", to: "/patients", icon: Building2 },
  { label: "Appointments", to: "/appointments", icon: Calendar },
];
const ADMIN_LINKS = [
  { label: "Billing", to: "/billing", icon: ReceiptText },
  { label: "Specializations", to: "/specializations", icon: Stethoscope },
  { label: "Services", to: "/services", icon: ClipboardList },
];
const ROOMS_LINKS = [
  { label: "Infrastructure", to: "/ipd/infrastructure", icon: Network },
  { label: "Room Allocation", to: "/rooms", icon: Bed },
  { label: "Room Logs", to: "/rooms/logs", icon: ClipboardList },
  { label: "IPD Admissions", to: "/admissions", icon: BedDouble },
];
const AMBULANCE_LINKS = [
  { label: "Book", to: "/ambulance/book", icon: Ambulance },
  { label: "Status", to: "/ambulance/status", icon: Activity },
];
const RADIOLOGY_LINKS = [
  { label: "Imaging Queue", to: "/radiology", icon: ScanLine },
  { label: "Reports", to: "/radiology/reports", icon: FileText }
];
const HR_LINKS = [
  { label: "Staff Directory", to: "/staffs", icon: UserSquare2 },
  { label: "Shift Roster", to: "/staffs/roster", icon: CalendarDays },
  { label: "Departments", to: "/staffs/departments", icon: Building2 },
  { label: "Designations", to: "/staffs/designations", icon: Award },
];
const EXTERNAL_APPS = [
  { label: "Finance", href: "https://finance.zenohosp.com", icon: BarChart2 },
  { label: "Inventory", href: "https://inventory.zenohosp.com", icon: Boxes },
  { label: "Directory", href: "https://directory.zenohosp.com", icon: BookOpen },
  { label: "Assets", href: "https://asset.zenohosp.com", icon: LayoutGrid }
];
function Sidebar({ isOpen }) {
  const { user } = useAuth();
  const location = useLocation();
  const [hrOpen, setHrOpen] = useState(() => location.pathname.startsWith("/staffs"));
  const [radOpen, setRadOpen] = useState(() => location.pathname.startsWith("/radiology"));
  const [roomsOpen, setRoomsOpen] = useState(() => location.pathname.startsWith("/rooms") || location.pathname.startsWith("/admissions") || location.pathname.startsWith("/ipd"));
  const [ambOpen, setAmbOpen] = useState(() => location.pathname.startsWith("/ambulance"));
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
  const roomsActive = location.pathname.startsWith("/rooms") || location.pathname.startsWith("/admissions") || location.pathname.startsWith("/ipd");
  const renderLink = (link, indent = false) => {
    const Icon = link.icon;
    return isOpen ? <NavLink
      key={link.to}
      to={link.to}
      end={link.to === "/staffs"}
      className={({ isActive }) => `flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                    ${indent ? "px-3 pl-8" : "px-3"}
                    ${isActive ? "bg-slate-100 dark:bg-[#1e1e1e] text-slate-900 dark:text-white" : "text-slate-700 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white"}`}
    >{({ isActive }) => <><Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-slate-700 dark:text-white" : ""}`} /><span className="truncate">{link.label}</span></>}</NavLink> : <NavLink
      key={link.to}
      to={link.to}
      end={link.to === "/staffs"}
      title={link.label}
      className={({ isActive }) => `flex items-center justify-center w-full py-3 rounded-lg transition-colors duration-150 ${isActive ? "bg-slate-100 dark:bg-[#1e1e1e] text-slate-900 dark:text-white" : "text-slate-700 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white"}`}
    ><Icon className="w-4 h-4 text-inherit" /></NavLink>;
  };
  const renderExternalApp = (app) => {
    const Icon = app.icon;
    return isOpen ? <a
      key={app.href}
      href={app.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-slate-700 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white group"
    ><Icon className="w-4 h-4 shrink-0" /><span className="truncate flex-1">{app.label}</span><ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" /></a> : <a
      key={app.href}
      href={app.href}
      target="_blank"
      rel="noopener noreferrer"
      title={app.label}
      className="flex items-center justify-center w-full py-3 rounded-lg transition-colors duration-150 text-slate-700 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white"
    ><Icon className="w-4 h-4 text-inherit" /></a>;
  };
  const renderAccordionSection = (links, label, AccIcon, open, setOpen, active) => {
    if (!isOpen) return links.map((link) => renderLink(link));
    return <div><button
      onClick={() => setOpen((o) => !o)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                        ${active ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-[#aaaaaa] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-900 dark:hover:text-white"}`}
    ><AccIcon className={`w-4 h-4 shrink-0 ${active ? "text-slate-900 dark:text-white dark:text-slate-300" : ""}`} /><span className="flex-1 text-left truncate">{label}</span><ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""} opacity-50`} /></button>{open && <div className="mt-0.5 space-y-0.5">{links.map((link) => renderLink(link, true))}</div>}</div>;
  };
  const renderHrAccordion = () => renderAccordionSection(HR_LINKS, "HR & Staff", ClipboardList, hrOpen, setHrOpen, hrActive);
  const renderRoomsAccordion = () => renderAccordionSection(ROOMS_LINKS, "IPD Management", BedDouble, roomsOpen, setRoomsOpen, roomsActive);
  const ambActive = location.pathname.startsWith("/ambulance");
  const renderAmbulanceAccordion = () => renderAccordionSection(AMBULANCE_LINKS, "Ambulance", Ambulance, ambOpen, setAmbOpen, ambActive);
  return <aside
    className={`flex flex-col h-full transition-all duration-300 ease-in-out shrink-0
                bg-white dark:bg-[#111111] border-r border-slate-200 dark:border-[#222222]
                ${isOpen ? "w-60" : "w-16"}`}
  >{
      /* Logo */
    }<div className={`flex items-center border-b border-slate-200 dark:border-[#222222] h-14 ${isOpen ? "gap-3 px-4" : "justify-center"}`}><div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shrink-0"><Activity className="w-4 h-4 text-white" /></div>{isOpen && <div className="overflow-hidden"><p className="font-bold text-sm leading-tight tracking-wider text-slate-900 dark:text-white">ZenoHosp</p><p className="text-xs text-slate-600 dark:text-[#888888] truncate mt-0.5">{user?.hospitalName}</p></div>}</div>{
      /* Navigation */
    }<nav className="flex-1 py-3 space-y-0.5 overflow-y-auto px-2">{isOpen && <div className="px-3 mb-2 mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#777777]">
      Main Menu
    </div>}{renderLink(DASHBOARD_LINK)}{isOpen && <div className="px-3 mb-2 mt-10 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#777777]">
      Hospital
    </div>}{filteredClinicalLinks.map((link) => renderLink(link))}{renderRoomsAccordion()}{renderAccordionSection(RADIOLOGY_LINKS, "Radiology", ScanLine, radOpen, setRadOpen, radActive)}{filteredAdminLinks.map((link) => renderLink(link))}{isHrAdmin && renderHrAccordion()}</nav>{
      /* Other Apps at bottom */
    }<div className="border-t border-slate-200 dark:border-[#222222] p-2 space-y-0.5 shrink-0">{isOpen && <div className="px-3 mb-2 mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#777777]">
      Other Apps
    </div>}{EXTERNAL_APPS.map((app) => renderExternalApp(app))}</div></aside>;
}
export {
  Sidebar as default
};
