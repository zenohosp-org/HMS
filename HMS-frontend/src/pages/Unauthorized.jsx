import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
function Unauthorized() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isUnregisteredStaff = user && ["DOCTOR", "STAFF"].includes(user.role) && !user.hospitalId;
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4"><div className="card p-10 max-w-md w-full text-center"><div className="text-6xl mb-4">{isUnregisteredStaff ? "\u{1F3E5}" : "\u{1F512}"}</div><h1 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">{isUnregisteredStaff ? "Account Not Registered for This Hospital" : "Access Denied"}</h1><p className="text-slate-500 dark:text-slate-600 text-sm leading-relaxed mb-6">{isUnregisteredStaff ? <>
                            Your account{" "}<span className="font-medium text-slate-700 dark:text-slate-300">
                                ({user?.email})
                            </span>{" "}
                            has not been added to any hospital yet.
                            <br /><br />
                            Please contact your <strong>Hospital Administrator</strong> to add
                            your account before you can access the system.
                        </> : <>
                            You don't have permission to access this page.
                            {user && <>{" "}Logged in as{" "}<span className="font-medium text-slate-700 dark:text-slate-300">{user.email}</span>{" "}
                                    ({user.roleDisplay}).
                                </>}</>}</p><div className="flex flex-col gap-3"><button
    className="btn-secondary"
    onClick={() => navigate("/login")}
  >
                        ← Back to Login
                    </button>{user && <button
    className="text-sm text-red-500 hover:text-red-600 transition-colors"
    onClick={logout}
  >
                            Sign Out
                        </button>}</div></div></div>;
}
export {
  Unauthorized as default
};
