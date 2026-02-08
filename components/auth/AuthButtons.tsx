// components/auth/AuthButtons.tsx
"use client";

import React from "react";
import { auth } from "@/lib/firebase";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";

type Mode = "idle" | "signup" | "login";

function mapFirebaseError(msg?: string): string {
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.includes("auth/email-already-in-use"))
    return "That email is already in use.";
  if (msg.includes("auth/invalid-email"))
    return "Please enter a valid email address.";
  if (
    msg.includes("auth/invalid-credential") ||
    msg.includes("auth/wrong-password")
  ) {
    return "Incorrect email or password.";
  }
  if (msg.includes("auth/user-not-found"))
    return "No account found with that email.";
  if (msg.includes("auth/weak-password"))
    return "Password should be at least 6 characters.";
  return "Authentication error. Please try again.";
}

export function AuthButtons() {
  const { user } = useAuth();
  const [mode, setMode] = React.useState<Mode>("idle");
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [name, setName] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setEmail("");
    setPass("");
    setName("");
    setErr(null);
    setMode("idle");
    setBusy(false);
  };

  const validateEmail = (val: string) => /\S+@\S+\.\S+/.test(val);
  const canSignup =
    name.trim().length > 0 && validateEmail(email) && pass.length >= 6;
  const canLogin = validateEmail(email) && pass.length >= 6;

  const doSignup = async () => {
    try {
      setBusy(true);
      setErr(null);
      await setPersistence(auth, browserLocalPersistence);
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      reset();
    } catch (e: any) {
      setErr(mapFirebaseError(e?.message));
      setBusy(false);
    }
  };

  const doLogin = async () => {
    try {
      setBusy(true);
      setErr(null);
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, pass);
      reset();
    } catch (e: any) {
      setErr(mapFirebaseError(e?.message));
      setBusy(false);
    }
  };

  if (user) {
    const who =
      user.displayName || (user.email ? user.email.split("@")[0] : "there");
    return (
      <div className="flex items-center gap-3 rounded-md border bg-background/60 px-3 py-2 backdrop-blur">
        <span className="text-sm">
          Hi, <b>{who}</b>
        </span>
        <Button
          variant="secondary"
          onClick={() => signOut(auth)}
          aria-label="Log out"
          title="Log out"
        >
          Logout
        </Button>
      </div>
    );
  }

  if (mode === "signup") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border bg-background/60 p-3 backdrop-blur">
        <input
          className="w-64 rounded border px-3 py-2"
          placeholder="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <input
          className="w-64 rounded border px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
          type="email"
        />
        <input
          className="w-64 rounded border px-3 py-2"
          placeholder="Password (min 6 chars)"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        {err && <p className="w-64 text-left text-sm text-red-500">{err}</p>}
        <div className="mt-1 flex w-64 gap-2">
          <Button
            onClick={doSignup}
            disabled={!canSignup || busy}
            className="flex-1"
          >
            {busy ? "Creating…" : "Create account"}
          </Button>
          <Button
            variant="ghost"
            onClick={reset}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "login") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border bg-background/60 p-3 backdrop-blur">
        <input
          className="w-64 rounded border px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
          type="email"
          autoFocus
        />
        <input
          className="w-64 rounded border px-3 py-2"
          placeholder="Password"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        {err && <p className="w-64 text-left text-sm text-red-500">{err}</p>}
        <div className="mt-1 flex w-64 gap-2">
          <Button
            onClick={doLogin}
            disabled={!canLogin || busy}
            className="flex-1"
          >
            {busy ? "Logging in…" : "Login"}
          </Button>
          <Button
            variant="ghost"
            onClick={reset}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={() => setMode("signup")}>Sign up</Button>
      <Button
        variant="secondary"
        onClick={() => setMode("login")}
      >
        Log in
      </Button>
    </div>
  );
}
