import React from "react";
import { motion } from "framer-motion";
import { useSchoolBranding, SCHOOL_NAME_FALLBACK } from "../hooks/useSchoolBranding";
import SecureImage from "./SecureImage";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  helper?: React.ReactNode;
  audience?: "admin" | "teacher" | "guardian" | "generic";
}

const AUDIENCE_META = {
  admin: {
    badge: "Admin Access",
    headline: "Operations & Oversight Console",
    description:
      "Coordinate academics, staff, fees, and compliance from a secure command center built for school leadership.",
    highlights: [
      "Academic governance & timetable controls",
      "Fee oversight, approvals, and audit-ready records",
      "Staff, student, and parent administration",
    ],
    accent: "from-emerald-400 via-sky-400 to-slate-200",
  },
  teacher: {
    badge: "Teacher Workspace",
    headline: "Classroom Control, Simplified",
    description:
      "Manage attendance, assignments, marks, and communication from a focused teaching cockpit.",
    highlights: [
      "Attendance, homework, and marks in minutes",
      "Timetable and classroom communication in one view",
      "Daily workflows optimized for teaching",
    ],
    accent: "from-indigo-300 via-sky-400 to-emerald-300",
  },
  guardian: {
    badge: "Student & Parent Access",
    headline: "Progress, Results, and Updates",
    description:
      "Track attendance, results, notices, fees, and assignments with a simple, mobile-first experience.",
    highlights: [
      "Results, attendance, and fee updates",
      "Notices and assignments in one place",
      "Friendly access built for busy families",
    ],
    accent: "from-sky-300 via-emerald-300 to-amber-200",
  },
  generic: {
    badge: "Secure Access",
    headline: "SaiyoniX ERP Entry",
    description:
      "Sign in to your institution workspace with secure, role-based access.",
    highlights: [
      "Role-specific access controls",
      "Secure sessions and audit trails",
      "Modern workflows for every team",
    ],
    accent: "from-sky-400 via-slate-300 to-emerald-300",
  },
} as const;

export default function AuthShell({
  title,
  subtitle,
  children,
  helper,
  audience = "generic",
}: AuthShellProps) {
  const { branding } = useSchoolBranding();
  const displayName = branding.schoolName || SCHOOL_NAME_FALLBACK;
  const meta = AUDIENCE_META[audience] ?? AUDIENCE_META.generic;

  return (
    <div className="flex min-h-screen min-h-[100dvh] w-full bg-slate-50">
      <div className="relative hidden w-full max-w-[46%] flex-col justify-between overflow-hidden bg-slate-950 px-12 py-12 lg:flex">
        <div className="absolute inset-0">
          <div className={`absolute -top-24 right-[-8%] h-[360px] w-[360px] rounded-full bg-gradient-to-br ${meta.accent} opacity-40 blur-[120px]`} />
          <div className="absolute -bottom-24 left-[-10%] h-[360px] w-[360px] rounded-full bg-sky-500/20 blur-[120px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_60%)]" />
          <div className="absolute inset-0 bg-[url('/bg-grid.svg')] opacity-[0.04] bg-[length:28px_28px]" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-md"
          >
            {branding.logoUrl ? (
              <SecureImage fileUrl={branding.logoUrl} alt="School logo" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-lg font-bold text-white">{displayName.slice(0, 1).toUpperCase()}</span>
            )}
          </motion.div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">{displayName}</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-slate-300">SaiyoniX ERP</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-100">
            {meta.badge}
          </span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl font-semibold leading-tight text-white"
          >
            {meta.headline}
          </motion.h1>
          <p className="text-base leading-relaxed text-slate-300">{meta.description}</p>
          <div className="space-y-3">
            {meta.highlights.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-slate-200">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="text-sm text-slate-200">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs font-medium text-slate-400">
          Secure sessions • Audit-ready access • Always-on support
        </div>
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-20">
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-white to-transparent lg:hidden" />
        <div className="relative z-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm">
            {branding.logoUrl ? (
              <SecureImage fileUrl={branding.logoUrl} alt="School logo" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-base font-bold">{displayName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900">{displayName}</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-slate-500">SaiyoniX</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-8 w-full max-w-[460px] rounded-[28px] border border-white/60 bg-white/95 px-6 py-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] sm:px-10 sm:py-10 lg:mt-0"
        >
          <div className="mb-8 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">{meta.badge}</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="text-[15px] text-slate-600">{subtitle}</p>}
          </div>

          <div className="w-full">
            {children}
          </div>

          {helper && (
            <div className="mt-8 border-t border-slate-100 pt-6">
              {helper}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
