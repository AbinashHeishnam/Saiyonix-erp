import Card from "./Card";

export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          Under development
        </div>
        <div>
          <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
          {description ? (
            <p className="mt-2 text-sm text-ink-500">{description}</p>
          ) : null}
        </div>
        <div className="rounded-xl border border-dashed border-ink-100 bg-ink-50/80 px-4 py-4 text-xs text-ink-500">
          This feature is documented for the platform and is being prepared for rollout.
        </div>
      </div>
    </Card>
  );
}
