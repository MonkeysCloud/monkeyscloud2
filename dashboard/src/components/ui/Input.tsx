import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-surface-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={clsx(
          "block w-full rounded-lg border bg-surface-800 px-3.5 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-900 transition-colors",
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-surface-600 focus:ring-brand-500 hover:border-surface-500",
          className
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
