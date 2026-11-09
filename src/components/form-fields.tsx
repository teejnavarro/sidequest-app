import { IdeaTypeIcon } from "@/components/idea-type";
import { errorClass, helpClass, labelClass } from "@/components/ui";

// Small form pieces shared by the idea form and the schedule form.

export function describedBy(id: string, error?: string, help?: string) {
  return [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

export function Field({
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {help ? (
        <span id={`${id}-help`} className={helpClass}>
          {help}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className={errorClass}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

// A group of round choices where you pick one. They are real radio buttons, so the keyboard
// and screen readers work, drawn as chips. The choice stays after an error.
export function ChoiceChips({
  name,
  legend,
  options,
  value,
  error,
  onChange,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string; icon?: boolean }[];
  value: string;
  error?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset
      className="grid min-w-0 gap-1.5 border-0 p-0"
      aria-describedby={error ? `${name}-error` : undefined}
    >
      <legend className={`${labelClass} mb-1.5 p-0`}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={value === option.value}
              onChange={() => onChange?.(option.value)}
              className="peer absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <span
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-chip px-3.5 text-sm font-bold text-ink peer-checked:bg-blue-soft peer-checked:text-blue-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-text`}
            >
              {option.icon ? <IdeaTypeIcon type={option.value} /> : null}
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <span id={`${name}-error`} className={errorClass}>
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}
