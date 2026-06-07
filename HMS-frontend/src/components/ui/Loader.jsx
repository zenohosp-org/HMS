import { Loader2 } from "lucide-react";

export function Spinner({ size = 16, className = "", ...props }) {
    return <Loader2 size={size} className={`animate-spin ${className}`} {...props} />;
}

export function CenterLoader({ text = "Loading...", className = "", iconClassName = "w-6 h-6 text-slate-400" }) {
    return (
        <div className={`flex flex-col items-center justify-center w-full h-full p-8 gap-3 text-slate-500 ${className}`}>
            <Spinner className={iconClassName} />
            {text && <p className="text-sm font-medium">{text}</p>}
        </div>
    );
}
