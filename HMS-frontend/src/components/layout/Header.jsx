import { useTheme } from "@/context/ThemeContext";
import { Menu, Sun, Moon, Bell } from "lucide-react";
function Header({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
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
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </button>
      </div>
    </header>
  );
}
export {
  Header as default
};
