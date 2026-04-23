import { createContext, useContext, useState, useCallback } from "react";
const NotificationContext = createContext(void 0);
function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);
  const notify = useCallback((message, type = "info") => {
    const id = crypto.randomUUID();
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 4e3);
  }, [dismiss]);
  return <NotificationContext.Provider value={{ notifications, notify, dismiss }}>{children}{
    /* Toast container */
  }<div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">{notifications.map((n) => <div
    key={n.id}
    className={`flex items-start gap-3 p-3 rounded-lg shadow-lg text-sm font-medium
              ${n.type === "success" ? "bg-emerald-500 text-white" : ""}
              ${n.type === "error" ? "bg-red-500 text-white" : ""}
              ${n.type === "warning" ? "bg-amber-500 text-white" : ""}
              ${n.type === "info" ? "bg-blue-500 text-white" : ""}
              animate-in slide-in-from-right-4 duration-200`}
  ><span className="flex-1">{n.message}</span><button onClick={() => dismiss(n.id)} className="ml-auto opacity-75 hover:opacity-100">✕</button></div>)}</div></NotificationContext.Provider>;
}
function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used inside <NotificationProvider>");
  return ctx;
}
export {
  NotificationProvider,
  useNotification
};
