import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import AcademicYearFilter from "../../components/AcademicYearFilter";

type ArchiveSection = {
  title: string;
  description: string;
  path: string;
};

const archiveSections: ArchiveSection[] = [
  {
    title: "Students",
    description: "Year-specific student roster and enrollment records.",
    path: "/admin/students",
  },
  {
    title: "Teachers",
    description: "Faculty list and assignment history for the selected year.",
    path: "/admin/teachers",
  },
  {
    title: "Classes & Sections",
    description: "Class setup, sections, and mappings per academic year.",
    path: "/admin/classes",
  },
  {
    title: "Promotion Transitions",
    description: "Promotion outcomes, transitions, and audit trail.",
    path: "/admin/promotions/overview",
  },
  {
    title: "Results / Reports",
    description: "Exam results, report cards, and rank summaries.",
    path: "/results",
  },
  {
    title: "Fees / Payment History",
    description: "Fee structures, payments, and pending dues by year.",
    path: "/admin/fees/overview",
  },
  {
    title: "Attendance Summaries",
    description: "Attendance trends and historical attendance data.",
    path: "/admin/analytics",
  },
];

export default function AdminRecordsArchivePage() {
  const [academicYearId, setAcademicYearId] = useState("");

  const querySuffix = useMemo(() => {
    return academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : "";
  }, [academicYearId]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <PageHeader title="Records / Archive" subtitle="Browse historical data by academic year." />

      <Card title="Academic Year">
        <AcademicYearFilter
          value={academicYearId}
          onChange={setAcademicYearId}
          includeAllOption={false}
          syncQueryKey="academicYearId"
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {archiveSections.map((section) => (
          <Card key={section.title} title={section.title} subtitle={section.description}>
            <Link
              to={`${section.path}${querySuffix}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-600"
            >
              View Records
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
