import type { AcademicYear } from "../services/api/metadata";

export function getActiveAcademicYear(years: AcademicYear[]) {
  return years.find((year) => year.isActive) ?? years[0];
}
