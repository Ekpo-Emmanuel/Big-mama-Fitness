"use client";
import { useId, useState } from "react";
import { inputClass } from "./ui";
export function PasswordField({
  name = "password",
  autoComplete = "current-password",
  label = "Password",
}: {
  name?: string;
  autoComplete?: string;
  label?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          required
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          maxLength={256}
          className={`${inputClass} mt-0 pr-14`}
        />
        <button
          type="button"
          aria-controls={id}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((open) => !open)}
          className="absolute inset-y-0 right-1 my-1 inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-sm font-bold text-ink hover:bg-ink/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
