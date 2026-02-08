"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Button } from "@/components/ui/button";

type Mode = "signup" | "login";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.replace("/dashboard");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 w-full max-w-sm rounded-lg border p-6">
      <h1 className="mb-4 text-center text-2xl font-semibold">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>

      <form
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <div className="text-left">
          <label className="mb-1 block text-sm">Email</label>
          <input
            type="email"
            required
            className="w-full rounded border px-3 py-2 outline-none focus:ring"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="text-left">
          <label className="mb-1 block text-sm">Password</label>
          <input
            type="password"
            required
            minLength={6}
            className="w-full rounded border px-3 py-2 outline-none focus:ring"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-muted-foreground">Min 6 characters</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          type="submit"
          disabled={busy}
          className="w-full"
        >
          {busy ? "Please wait…" : mode === "signup" ? "Sign Up" : "Login"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <a
              className="underline"
              href="/login"
            >
              Login
            </a>
          </>
        ) : (
          <>
            New here?{" "}
            <a
              className="underline"
              href="/signup"
            >
              Create an account
            </a>
          </>
        )}
      </p>
    </div>
  );
}
