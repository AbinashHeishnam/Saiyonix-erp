export type JobType =
  | "RESULTS_RECOMPUTE"
  | "RESULTS_PUBLISH"
  | "RANKING_RECOMPUTE"
  | "ADMIT_CARD_GENERATE"
  | "ADMIT_CARD_PDF_GENERATE"
  | "REPORT_CARD_PDF_GENERATE"
  | "ASSIGNMENT_REMINDER";

export type JobPayload =
  | { type: "RESULTS_RECOMPUTE"; schoolId: string; examId: string }
  | {
      type: "RESULTS_PUBLISH";
      schoolId: string;
      examId: string;
      actor: { userId: string; roleType: "SUPER_ADMIN" | "ADMIN" | "ACADEMIC_SUB_ADMIN" };
    }
  | { type: "RANKING_RECOMPUTE"; schoolId: string; examId: string }
  | { type: "ADMIT_CARD_GENERATE"; schoolId: string; examId: string }
  | { type: "ADMIT_CARD_PDF_GENERATE"; schoolId: string; examId: string }
  | { type: "REPORT_CARD_PDF_GENERATE"; schoolId: string; examId: string; studentId: string }
  | { type: "ASSIGNMENT_REMINDER"; schoolId: string };
