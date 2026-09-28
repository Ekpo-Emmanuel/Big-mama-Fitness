"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { PasswordField } from "@/components/password-field";
import { Section, buttonClass, inputClass } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    const data = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({
        email: String(data.get("email") || ""),
        password: String(data.get("password") || ""),
      });
      if (result.error) {
        setError(true);
        setBusy(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  return (
    <Section className="max-w-md">
      <p className="mb-6 font-display text-2xl uppercase">Big Mama Fitness</p>
      <h1 className="text-3xl font-bold">Organizer sign in</h1>
      <p className="mt-3 text-sm text-ink/70">
        Your guests, your events, your community.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block font-bold">
          Email
          <input
            required
            name="email"
            type="email"
            autoComplete="username"
            maxLength={254}
            className={inputClass}
          />
        </label>
        <PasswordField />
        {error && (
          <p role="alert" className="motion-enter text-red-800">
            Sign-in failed. Check your email and password and try again.
          </p>
        )}
        <button
          disabled={busy}
          aria-busy={busy}
          className={`${buttonClass} w-full`}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Section>
  );
}
