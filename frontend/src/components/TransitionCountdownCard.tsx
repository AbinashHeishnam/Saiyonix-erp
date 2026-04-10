import { useEffect, useMemo, useState } from "react";

type TransitionCountdownCardProps = {
  title?: string;
  endsAt?: string | null;
  allowed?: boolean;
  className?: string;
  activeLabel?: string;
  expiredLabel?: string;
};

function formatRemaining(target: Date, now: number) {
  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return { days, hours, minutes };
}

export default function TransitionCountdownCard({
  title = "Previous Year Interaction",
  endsAt,
  allowed,
  className,
  activeLabel = "Interaction available until",
  expiredLabel = "Interaction closed — View only",
}: TransitionCountdownCardProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const target = endsAt ? new Date(endsAt) : null;
  const expired = !target || now >= target.getTime();
  const finalExpired = allowed === false ? true : expired;
  const remaining = useMemo(
    () => (target ? formatRemaining(target, now) : null),
    [target, now]
  );

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50 p-3 ${className ?? ""}`}
    >
      <p className="text-sm font-semibold">{title}</p>
      {target ? (
        <div className="mt-1 text-xs text-slate-500">
          {finalExpired ? (
            <span>{expiredLabel}</span>
          ) : (
            <span>
              {activeLabel} {target.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} •{" "}
              {remaining
                ? `${remaining.days}d ${remaining.hours}h ${remaining.minutes}m remaining`
                : "countdown unavailable"}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-500">Transition window unavailable</p>
      )}
    </div>
  );
}
