import { Loader2 } from "lucide-react";

export default function GlobalLoader() {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
                <p className="text-sm font-medium text-slate-600 animate-pulse">Loading ZenoHosp...</p>
            </div>
        </div>
    );
}
