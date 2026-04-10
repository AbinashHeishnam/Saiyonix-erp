export type GradeBoundary = {
  min: number;
  grade: string;
};

export const gradeBoundaries: GradeBoundary[] = [
  { min: 90, grade: "A+" },
  { min: 80, grade: "A" },
  { min: 70, grade: "B" },
  { min: 60, grade: "C" },
  { min: 50, grade: "D" },
  { min: 0, grade: "F" },
];

export function computeGradeFromPercentage(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  for (const boundary of gradeBoundaries) {
    if (normalized >= boundary.min) {
      return boundary.grade;
    }
  }

  return "F";
}
