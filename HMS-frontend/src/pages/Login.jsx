import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (import.meta.env.VITE_DEV_MOCK_AUTH === 'true') {
      navigate("/", { replace: true });
    }
  }, [navigate]);
  const loggedOut = searchParams.get("logged_out");
  const error = searchParams.get("error");

  const errorMessages = {
    session_validation_failed: "Session validation failed. Please sign in again.",
    sso_failed: "SSO login failed. Please try again.",
    user_not_found: "Your account is not registered in HMS. Contact your admin.",
    account_inactive: "Your account is inactive. Contact your admin.",
    no_hms_access: "HMS access is not enabled for your account.",
    role_missing: "Your account has no role assigned. Contact your admin.",
  };

  const errorMessage = error ? (errorMessages[error] ?? "Login failed. Please try again.") : null;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-[#0f0f0f]">

      {/* Left — Sign in */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm space-y-10">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-none">ZenoHosp</h1>
              <p className="text-xs text-slate-400 dark:text-[#666] font-medium mt-1">Hospital Management System</p>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
            <p className="text-sm text-slate-500 dark:text-[#666]">
              Sign in with your ZenoHosp account to continue.
            </p>
          </div>

          {/* Alerts */}
          {loggedOut && (
            <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] text-sm text-slate-600 dark:text-[#888]">
              You have been signed out successfully.
            </div>
          )}
          {errorMessage && (
            <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-700 dark:text-rose-400">
              {errorMessage}
            </div>
          )}

          {/* SSO Button */}
          <button
            type="button"
            onClick={() => { window.location.href = "/oauth2/authorization/directory"; }}
            className="w-full py-4 bg-slate-900 dark:bg-white hover:bg-slate-900 dark:bg-white text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
          >
            <Activity className="w-5 h-5" />
            Sign in with ZenoHosp Directory
          </button>

          <p className="text-center text-xs text-slate-400 dark:text-[#555] font-medium">
            By continuing, you agree to our{" "}
            <span className="text-slate-900 dark:text-white dark:text-slate-300 hover:underline cursor-pointer">
              Terms of Service
            </span>
          </p>
        </div>
      </div>

      {/* Right — Visual */}
      <div className="hidden lg:flex w-[55%] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 relative overflow-hidden items-center justify-center p-16">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-black/10 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-lg space-y-10">
          <div className="space-y-4">
            <h2 className="text-5xl font-extrabold text-white leading-tight">
              Modern Healthcare Management
            </h2>
            <p className="text-lg text-emerald-50/80 font-medium leading-relaxed">
              Manage your hospital, patients, and team — all from one secure, multi-tenant platform.
            </p>
          </div>
          <div className="space-y-6">
            {[
              "Multi-hospital support with data isolation",
              "Role-based access: Admin, Doctor, Staff",
              "Single sign-on via ZenoHosp Directory",
              "Real-time patient records & audit trail",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-4 text-white">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center border border-white/30 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <span className="font-semibold">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
