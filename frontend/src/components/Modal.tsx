import React, { useEffect, useRef } from "react";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    mobileSheet?: boolean;
}

const sizeClasses: Record<string, string> = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-none w-[96vw] h-[92vh]",
};

export default function Modal({ open, onClose, title, children, size = "md", mobileSheet = false }: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleEsc);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleEsc);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    if (!open) return null;

    const sheetClasses = mobileSheet
        ? "sm:rounded-2xl sm:max-h-full max-h-[85vh] rounded-t-2xl rounded-b-none fixed bottom-0 sm:relative sm:bottom-auto animate-slide-in-bottom sm:animate-scale-in"
        : "rounded-2xl animate-scale-in";

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-fade-in"
                onClick={onClose}
            />

            <div
                ref={dialogRef}
                className={`relative w-full ${sizeClasses[size]} ${sheetClasses} bg-white shadow-modal border border-slate-200 flex flex-col max-h-full overflow-hidden dark:bg-slate-900 dark:border-slate-800`}
            >
                {/* Mobile sheet handle */}
                {mobileSheet && (
                    <div className="flex justify-center pt-3 pb-1 sm:hidden">
                        <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                    </div>
                )}

                {title && (
                    <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 px-6 py-4 dark:border-slate-800">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                        <button
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500 active:scale-95 border border-slate-200/50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                )}

                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}
