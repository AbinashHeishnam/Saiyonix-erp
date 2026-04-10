import type { StudentIdCardData } from "../services/api/idCards";
import { resolvePublicUrl } from "../services/api/client";

type StudentIdCardProps = {
  data: StudentIdCardData;
  className?: string;
};

export default function StudentIdCard({ data, className = "" }: StudentIdCardProps) {
  const dob = data.student.dateOfBirth
    ? new Date(data.student.dateOfBirth).toLocaleDateString("en-IN")
    : "—";
  const classLabel = [data.className, data.sectionName].filter(Boolean).join(" ");

  const photoUrl = data.student.photoUrl ? resolvePublicUrl(data.student.photoUrl) : null;
  const logoUrl = data.school.logoUrl ? resolvePublicUrl(data.school.logoUrl) : null;

  return (
    <div
      className={`relative w-[300px] h-[500px] rounded-[26px] border border-slate-200/70 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)] overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/15 via-white to-blue-50" />
      <div className="absolute top-0 left-0 h-24 w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-500" />
      <div className="absolute right-6 top-12 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute left-6 top-10 h-16 w-16 rounded-full bg-white/15 blur-2xl" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center gap-3 px-5 pt-4 text-white">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white/20 backdrop-blur">
            {logoUrl ? (
              <img src={logoUrl} alt="School logo" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-xs font-bold">LOGO</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold tracking-wide uppercase">{data.school.name}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-100">Student Identity Card</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center px-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-indigo-500/30 blur-lg" />
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-[4px] border-white shadow-lg">
              {photoUrl ? (
                <img src={photoUrl} alt={data.student.fullName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400 text-xs">
                  No Photo
                </div>
              )}
            </div>
          </div>
          <h3 className="mt-2 text-lg font-extrabold text-slate-800 text-center">
            {data.student.fullName}
          </h3>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Student</p>
        </div>

        <div className="mt-4 px-6 flex-1">
          <div className="grid grid-cols-[72px_1fr] gap-y-1.5 text-[11px]">

            <span className="font-semibold text-slate-400">Class</span>
            <span className="font-semibold text-slate-800">{classLabel || "—"}</span>

            <span className="font-semibold text-slate-400">Adm No</span>
            <span className="font-semibold text-slate-800">{data.student.admissionNumber ?? "—"}</span>

            <span className="font-semibold text-slate-400">Roll No</span>
            <span className="font-semibold text-slate-800">{data.rollNumber ?? "Pending"}</span>

            <span className="font-semibold text-slate-400">DOB</span>
            <span className="font-semibold text-slate-800">{dob}</span>

            <span className="font-semibold text-slate-400">Parent</span>
            <span className="font-semibold text-slate-800">{data.parentName ?? "—"}</span>

            <span className="font-semibold text-slate-400">Phone</span>
            <span className="font-semibold text-slate-800">{data.parentPhone ?? "—"}</span>

            <span className="font-semibold text-slate-400">Blood</span>
            <span className="font-semibold text-slate-800">{data.student.bloodGroup ?? "—"}</span>
          </div>

          {data.student.address && (
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 max-h-10 overflow-hidden">
              {data.student.address}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200/80 px-6 py-3 text-[10px] font-semibold text-slate-500 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate">{data.school.address ?? "Kanchipur"}</p>
            <p className="mt-1">{data.school.phone ? `Phone: ${data.school.phone}` : ""}</p>
          </div>
          <div className="h-12 w-12 rounded-lg border border-dashed border-slate-300 text-[8px] font-bold uppercase tracking-widest text-slate-400 flex items-center justify-center">
            QR CODE
          </div>
        </div>
      </div>
    </div>
  );
}
