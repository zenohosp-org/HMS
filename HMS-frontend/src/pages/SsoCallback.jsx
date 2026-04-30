import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [500, 1000, 2000]; // exponential backoff in ms

function SsoCallback() {
  const { user, isLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      const messages = {
        sso_failed: "SSO login failed. Please try again.",
        user_not_found: "Your account is not registered in HMS. Contact your admin.",
        account_inactive: "Your HMS account is inactive. Contact your admin.",
        no_hms_access: "HMS access is not enabled for your account. Please contact your directory admin.",
        role_missing: "Your account has no role assigned. Contact your admin.",
        internal_server_error: "An internal error occurred. Please try again."
      };
      setError(messages[errorParam] ?? "Login failed. Please try again.");
      setTimeout(() => navigate("/login", { replace: true }), 3000);
      return;
    }

    // AuthContext already loaded the user successfully — navigate directly.
    if (!isLoading && user) {
      navigate("/dashboard", { replace: true });
      return;
    }

    // AuthContext finished loading but user is null — the sso_token cookie may not
    // have propagated before the initial /auth/me fired (race condition on redirect).
    // Retry with exponential backoff before giving up.
    if (!isLoading && !user) {
      let cancelled = false;
      let attempt = 0;

      const tryValidate = async () => {
        const ok = await refreshUser();
        if (cancelled) return;

        if (ok) {
          // refreshUser set user in AuthContext; the effect will re-fire on the
          // next render with user set and navigate to /dashboard from the branch above.
          return;
        }

        if (attempt < MAX_RETRIES) {
          retryTimerRef.current = setTimeout(tryValidate, RETRY_DELAYS[attempt]);
          attempt++;
        } else {
          setError("Failed to validate your session. Please try signing in again.");
          retryTimerRef.current = setTimeout(
            () => { if (!cancelled) navigate("/login?error=session_validation_failed", { replace: true }); },
            3000
          );
        }
      };

      tryValidate();

      return () => {
        cancelled = true;
        clearTimeout(retryTimerRef.current);
      };
    }
  }, [searchParams, isLoading, user, navigate, refreshUser]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f0f0f]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-500 font-semibold">{error}</p>
          <p className="text-slate-400 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f0f0f]">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-700 dark:text-slate-300 font-semibold">Completing sign-in...</p>
        <p className="text-slate-400 text-sm">Please wait while we set up your session.</p>
      </div>
    </div>
  );
}

export { SsoCallback as default };
