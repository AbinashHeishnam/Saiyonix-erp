
type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
};

export default function ToggleSwitch({ checked, onChange, disabled, label }: Props) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 transition ${
        disabled ? "cursor-not-allowed opacity-50" : "hover:border-jade-300"
      } ${checked ? "border-jade-300 bg-jade-50" : "border-ink-200 bg-white"}`}
      aria-pressed={checked}
      aria-label={label ?? "Toggle"}
    >
      <span
        className={`h-4 w-7 rounded-full p-0.5 transition ${
          checked ? "bg-jade-500" : "bg-ink-200"
        }`}
      >
        <span
          className={`block h-3 w-3 rounded-full bg-white transition ${
            checked ? "translate-x-3" : "translate-x-0"
          }`}
        />
      </span>
      {label && <span className="text-xs font-medium text-ink-600">{label}</span>}
    </button>
  );
}
