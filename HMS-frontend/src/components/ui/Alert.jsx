/**
 * Banner-style alert message — used in confirmation modals and form
 * warnings. For toast-style notifications keep using the existing
 * NotificationContext (which is a separate concern).
 *
 * Props
 *   tone      "info" | "warning" | "danger" | "success"  default "info"
 *   icon      optional ReactNode rendered on the left
 *   title     optional bold first line
 *   className extra classes appended
 *   children  body content (string or node)
 */
const TONE_TO_CLASS = {
    info: "is-blue",
    warning: "is-amber",
    danger: "is-red",
    success: "is-green",
};

export default function Alert({ tone = "info", icon, title, className = "", children }) {
    const toneClass = TONE_TO_CLASS[tone] || TONE_TO_CLASS.info;
    return (
        <div className={`hms-alert ${toneClass} ${className}`.trim()} role="alert">
            {icon && <div style={{ flexShrink: 0 }}>{icon}</div>}
            <div>
                {title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>}
                {children}
            </div>
        </div>
    );
}
