import React from "react";

export default function TableSkeleton({ rows = 5, columns = 4 }) {
    return (
        <div className="w-full animate-pulse">
            <div className="border-b border-slate-200 pb-3 mb-3 flex justify-between px-4">
                {Array.from({ length: columns }).map((_, i) => (
                    <div key={i} className="h-4 bg-slate-200 rounded w-1/5"></div>
                ))}
            </div>
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="border-b border-slate-100 py-4 flex justify-between px-4">
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <div
                            key={colIndex}
                            className={`h-4 bg-slate-100 rounded ${
                                colIndex === 0 ? "w-1/4" : colIndex === columns - 1 ? "w-1/12" : "w-1/6"
                            }`}
                        ></div>
                    ))}
                </div>
            ))}
        </div>
    );
}
