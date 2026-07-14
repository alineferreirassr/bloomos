import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  required,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-text">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error ? (
        <p className="mt-1.5 text-xs text-text-muted">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
