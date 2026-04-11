import React, { useRef, useEffect } from "react";

interface OtpInputProps {
    value: string;
    onChange: (val: string) => void;
    length?: number;
    autoFocus?: boolean;
}

export default function OtpInput({ value, onChange, length = 6, autoFocus = true }: OtpInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Initialize refs array
    useEffect(() => {
        inputRefs.current = inputRefs.current.slice(0, length);
    }, [length]);

    // Handle auto-focus on mount
    useEffect(() => {
        if (autoFocus) {
            const timeout = setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 100);
            return () => clearTimeout(timeout);
        }
    }, [autoFocus]);

    const otpArray = Array.from({ length }, (_, i) => value[i] || "");

    const handleOtpChange = (index: number, digit: string) => {
        if (!/^\d*$/.test(digit)) return;

        // Create new value string
        const newOtpArray = [...otpArray];
        newOtpArray[index] = digit.slice(-1); // Only keep last typed digit

        const newValue = newOtpArray.join("");
        onChange(newValue);

        // Auto-advance
        if (digit && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otpArray[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        if (!pasted) return;

        const newOtpArray = [...otpArray];
        for (let i = 0; i < pasted.length; i++) {
            newOtpArray[i] = pasted[i];
        }

        onChange(newOtpArray.join(""));

        const targetIndex = pasted.length < length ? pasted.length : length - 1;
        inputRefs.current[targetIndex]?.focus();
    };

    return (
        <div className="flex gap-2 sm:gap-3 justify-center" onPaste={handlePaste}>
            {otpArray.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    autoComplete="one-time-code"
                    className="h-12 w-[2.8rem] sm:h-14 sm:w-12 rounded-[14px] border border-slate-200/80 bg-slate-50/80 text-center text-xl font-semibold shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all duration-300 focus:bg-white focus:outline-none focus:border-sky-500 focus:ring-[3px] focus:ring-sky-500/15 dark:border-slate-800 dark:bg-slate-900/50 dark:text-white dark:focus:bg-slate-950 dark:focus:border-sky-500 dark:focus:ring-sky-500/20"
                />
            ))}
        </div>
    );
}
