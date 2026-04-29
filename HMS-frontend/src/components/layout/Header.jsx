import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Menu, Sun, Moon, Bell, LogOut } from "lucide-react";

function Header({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;

  return (
    <header className="h-14 bg-white dark:bg-[#111111] border-b border-slate-200 dark:border-[#222222] flex items-center px-4 gap-3 shrink-0">
      <button
        onClick={onMenuClick}
        className="text-slate-500 hover:text-slate-800 dark:text-[#666666] dark:hover:text-[#cccccc] p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>
      <span className="text-sm font-semibold text-slate-700 dark:text-[#cccccc] flex-1">
        Hospital Management System
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 dark:text-[#666666] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] hover:text-slate-800 dark:hover:text-[#cccccc] transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          className="p-2 rounded-lg text-slate-500 dark:text-[#666666] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] hover:text-slate-800 dark:hover:text-[#cccccc] transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white" />
        </button>

        <div className="h-8 w-px bg-slate-200 dark:bg-[#222222] mx-2" />

        <div className="flex items-center gap-3 ml-1">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#333333] border border-slate-300 dark:border-[#444444] flex items-center justify-center text-xs font-bold text-slate-700 dark:text-[#cccccc] shrink-0">
            {initials}
          </div>
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="text-xs text-slate-500 dark:text-[#666666]">
              {user?.roleDisplay}
            </span>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
export {
  Header as default
};
