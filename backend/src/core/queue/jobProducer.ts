import { Queue } from "bullmq";
import { getJobQueue } from "@/core/queue/queue";
import type { JobPayload } from "@/core/queue/types";
import { env } from "@/config/env";

function buildJobId(payload: JobPayload) {
  switch (payload.type) {
    case "RESULTS_RECOMPUTE":
      return `results:${payload.schoolId}:${payload.examId}`;
    case "RESULTS_PUBLISH":
      return `results-publish:${payload.schoolId}:${payload.examId}`;
    case "RANKING_RECOMPUTE":
      return `ranking:${payload.schoolId}:${payload.examId}`;
    case "ADMIT_CARD_GENERATE":
      return `admit:${payload.schoolId}:${payload.examId}`;
    case "ADMIT_CARD_PDF_GENERATE":
      return `admit-pdf:${payload.schoolId}:${payload.examId}`;
    case "REPORT_CARD_PDF_GENERATE":
      return `report-card-pdf:${payload.schoolId}:${payload.examId}:${payload.studentId}`;
    case "ASSIGNMENT_REMINDER":
      return `assignment-reminder:${payload.schoolId}`;
    default:
      return undefined;
  }
}

export async function enqueueJob(payload: JobPayload) {
  const jobId = buildJobId(payload);
  const queue = await getJobQueue();
  if (!(queue instanceof Queue)) {
    if (env.REDIS_ENABLED !== "false") {
      console.warn("[queue] enqueue skipped (redis unavailable)", payload.type, jobId);
    }
    return { status: "PROCESSING" };
  }
  try {
    await queue.add(payload.type, payload, { jobId });
  } catch (error) {
    console.warn("[queue] enqueue failed", payload.type, jobId, error);
  }
  return { status: "PROCESSING" };
}
