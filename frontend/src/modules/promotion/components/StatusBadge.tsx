import React from "react";
import BaseBadge from "../../../components/Badge";

type Status = "ELIGIBLE" | "FAILED" | "UNDER_CONSIDERATION" | string;

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  status?: Status;
};

const toneMap: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ELIGIBLE: "success",
  FAILED: "danger",
  UNDER_CONSIDERATION: "warning",
  PROMOTED: "success",
  NOT_PROMOTED: "danger",
  UNDER_REVIEW: "warning",
};

export default function StatusBadge({ status, className, ...props }: Props) {
  const tone = status ? toneMap[status] ?? "neutral" : "neutral";
  return <BaseBadge tone={tone} className={className} {...props} />;
}
