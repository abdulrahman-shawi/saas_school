"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AcademyLookupResult = {
  exists: boolean;
  id?: string;
  code?: string;
  name?: string;
  isActive?: boolean;
};

/**
 * Login screen for academy users using academy code, username, and password.
 */
export default function LoginPage() {
  const router = useRouter();
  const [academyCode, setAcademyCode] = useState("");
  const [academyName, setAcademyName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLookingUpAcademy, setIsLookingUpAcademy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /**
   * Fetches academy name from code for login confirmation.
   */
  async function lookupAcademy(code: string): Promise<void> {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setAcademyName("");
      return;
    }

    setIsLookingUpAcademy(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/academies/by-code?code=${encodeURIComponent(trimmedCode)}`,
        {
          method: "GET",
        },
      );
      const payload = (await response.json()) as AcademyLookupResult;

      if (!response.ok) {
        setAcademyName("");
        setErrorMessage(payload.exists ? "Academy lookup failed." : "Academy not found.");
        return;
      }

      if (!payload.exists || !payload.name) {
        setAcademyName("");
        setErrorMessage("Academy code not found.");
        return;
      }

      if (payload.isActive === false) {
        setAcademyName(payload.name);
        setErrorMessage("This academy is currently inactive.");
        return;
      }

      setAcademyName(payload.name);
    } catch {
      setErrorMessage("Could not verify academy code. Try again.");
      setAcademyName("");
    } finally {
      setIsLookingUpAcademy(false);
    }
  }

  /**
   * Sends login credentials and redirects to dashboard after success.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          academyCode,
          username,
          password,
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Login failed.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Login request failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Academy Login</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter academy code, username, and password.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="academyCode">
              Academy Code
            </label>
            <input
              id="academyCode"
              value={academyCode}
              onChange={(event) => {
                setAcademyCode(event.target.value);
                setAcademyName("");
              }}
              onBlur={() => lookupAcademy(academyCode)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-emerald-200 focus:ring"
              placeholder="e.g. demo-academy"
              required
            />
            {isLookingUpAcademy && (
              <p className="mt-1 text-xs text-slate-500">Checking academy...</p>
            )}
            {academyName && (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                Academy: {academyName}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-emerald-200 focus:ring"
              placeholder="username"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-emerald-200 focus:ring"
              placeholder="password"
              required
            />
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
