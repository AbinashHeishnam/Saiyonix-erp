import React from "react";
import BaseBadge from "../../../components/Badge";
import type { PromotionStatus } from "../../../services/api/promotion";

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  status?: PromotionStatus | "PROMOTED" | "UNDER_REVIEW" | "NOT_PROMOTED" | string;
};

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ELIGIBLE: "success",
  FAILED: "danger",
  UNDER_CONSIDERATION: "warning",
  PROMOTED: "success",
  UNDER_REVIEW: "warning",
  NOT_PROMOTED: "danger",
};

export default function Badge({ status, className, ...props }: Props) {
  const tone = status ? statusTone[status] ?? "neutral" : "neutral";
  return <BaseBadge tone={tone} className={className} {...props} />;
}
