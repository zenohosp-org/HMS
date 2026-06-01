import { useAuth } from "@/context/AuthContext";
import { Menu, Bell, LogOut } from "lucide-react";

function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
      {/* Sidebar toggle only when the layout actually has a sidebar to
          toggle. FocusLayout passes no onMenuClick so the burger
          disappears entirely on the consultation-view page. */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      <span className="text-sm font-semibold text-slate-700 flex-1">
        Hospital Management System
      </span>
      <div className="flex items-center gap-1">
        <button
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-900" />
        </button>

        <div className="h-8 w-px bg-slate-200 mx-2" />

        <div className="flex items-center gap-3 ml-1">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
            {initials}
          </div>
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-sm font-semibold text-slate-900 leading-tight">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="text-xs text-slate-500">
              {user?.roleDisplay}
            </span>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export { Header as default };
