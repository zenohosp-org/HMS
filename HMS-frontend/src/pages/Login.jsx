import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";

const FEATURES = [
    "Multi-hospital support with data isolation",
    "Role-based access: Admin, Doctor, Staff",
    "Single sign-on via ZenoHosp Directory",
    "Real-time patient records & audit trail",
];

const ERROR_MESSAGES = {
    session_validation_failed: "Session validation failed. Please sign in again.",
    sso_failed: "SSO login failed. Please try again.",
    user_not_found: "Your account is not registered in HMS. Contact your admin.",
    account_inactive: "Your account is inactive. Contact your admin.",
    no_hms_access: "HMS access is not enabled for your account.",
    role_missing: "Your account has no role assigned. Contact your admin.",
};

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        if (import.meta.env.VITE_DEV_MOCK_AUTH === "true") {
            navigate("/", { replace: true });
        }
    }, [navigate]);

    const loggedOut = searchParams.get("logged_out");
    const error = searchParams.get("error");
    const errorMessage = error ? ERROR_MESSAGES[error] ?? "Login failed. Please try again." : null;

    return (
        <div className="hms-login">
            {/* Left — Sign in */}
            <div className="hms-login__form-pane">
                <div className="hms-login__form-inner">
                    <div className="hms-login__brand">
                        <div className="hms-login__brand-icon">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="hms-login__brand-title">ZenoHosp</h1>
                            <p className="hms-login__brand-sub">Hospital Management System</p>
                        </div>
                    </div>

                    <div className="hms-login__heading">
                        <h2>Welcome back</h2>
                        <p>Sign in with your ZenoHosp account to continue.</p>
                    </div>

                    {loggedOut && (
                        <div className="hms-login__alert is-info">
                            You have been signed out successfully.
                        </div>
                    )}
                    {errorMessage && (
                        <div className="hms-login__alert is-danger">{errorMessage}</div>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            window.location.href = "/oauth2/authorization/directory";
                        }}
                        className="hms-login__sso-btn"
                    >
                        <Activity className="w-5 h-5" />
                        Sign in with ZenoHosp Directory
                    </button>

                    <p className="hms-login__terms">
                        By continuing, you agree to our{" "}
                        <span className="hms-login__terms-link">Terms of Service</span>
                    </p>
                </div>
            </div>

            {/* Right — Visual */}
            <div className="hms-login__visual">
                <div className="hms-login__visual-blur-1" />
                <div className="hms-login__visual-blur-2" />
                <div className="hms-login__visual-content">
                    <div className="hms-login__visual-headline">
                        <h2>Modern Healthcare Management</h2>
                        <p>
                            Manage your hospital, patients, and team — all from one secure,
                            multi-tenant platform.
                        </p>
                    </div>
                    <div className="hms-login__visual-features">
                        {FEATURES.map((feature, i) => (
                            <div key={i} className="hms-login__visual-feature">
                                <div className="hms-login__visual-feature-dot" />
                                <span className="hms-login__visual-feature-text">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
