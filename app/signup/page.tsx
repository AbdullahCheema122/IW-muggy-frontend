"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase"; 
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore"; 
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Star, Sparkles, Rocket, Mail, Lock, User } from "lucide-react";

function FantasyBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#FFF9C4] to-[#E0F7FA]">
      <div className="absolute top-20 right-[10%] opacity-20"><Rocket size={100} className="text-blue-400 -rotate-45" /></div>
      <div className="absolute bottom-20 left-[10%] opacity-20"><Sparkles size={80} className="text-yellow-400" /></div>
    </div>
  );
}

function KidInput({ label, icon: Icon, ...props }: any) {
  return (
    <div className="space-y-2 w-full">
      <label className="text-lg font-black text-blue-900 ml-4 flex items-center gap-2">
        <Icon size={18} className="text-blue-500" /> {label}
      </label>
      <input
        {...props}
        className="w-full rounded-full border-4 border-white bg-white/80 px-6 py-4 text-lg font-bold text-blue-900 shadow-inner outline-none focus:ring-4 focus:ring-blue-200 transition-all placeholder:text-blue-300"
      />
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Helper to create the Hero document safely
  async function createHeroRecord(user: any, heroName: string) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    
    // Only create if it doesn't exist (important for Google Login)
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: heroName || user.displayName || "New Hero",
        email: user.email,
        stars: 0, 
        lastActive: serverTimestamp(),
        createdAt: serverTimestamp(),
        photoURL: user.photoURL || ""
      });
    }
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 6) return setErr("Secret key needs 6+ symbols!");
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name.trim() });
      
      // Create the DB record immediately
      await createHeroRecord(cred.user, name.trim());

      router.replace("/dashboard");
    } catch (e: any) {
      setErr("Magic failed! Check your email or key.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleLogin() {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Ensure Google users also get a Hall of Heroes entry
      await createHeroRecord(result.user, result.user.displayName || "");
      router.replace("/dashboard");
    } catch (e) {
      setErr("Google Magic failed!");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center p-6 font-[var(--font-comic-sans)]">
      <FantasyBackdrop />
      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <div className="inline-block rounded-full bg-yellow-400 px-6 py-2 text-sm font-black text-white shadow-lg uppercase tracking-widest mb-4">Join Ms Muggy</div>
          <h1 className="text-5xl md:text-6xl font-black text-blue-950 italic">
            Create Your <span className="text-pink-500 underline underline-offset-8 decoration-yellow-400">Hero!</span>
          </h1>
        </div>

        <div className="rounded-[50px] border-[12px] border-white bg-white/90 p-8 shadow-2xl relative overflow-hidden">
          {err && <div className="mb-6 rounded-2xl bg-orange-100 border-2 border-orange-200 p-4 text-orange-700 font-black text-center">{err}</div>}
          <form onSubmit={onSignup} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <KidInput label="Hero Name" icon={User} placeholder="Super Sam" value={name} onChange={(e: any) => setName(e.target.value)} required />
              <KidInput label="Hero Mail" icon={Mail} type="email" placeholder="sam@magic.com" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
            </div>
            <KidInput label="Create Secret Key" icon={Lock} type="password" placeholder="6+ magic symbols" value={pass} onChange={(e: any) => setPass(e.target.value)} required />
            <button type="submit" disabled={busy} className="w-full rounded-full bg-[#4D96FF] py-6 text-3xl font-black text-white shadow-[0_10px_0_0_#3678D9] transition-all hover:bg-[#3B82F6] active:translate-y-[10px] active:shadow-none flex items-center justify-center gap-4 uppercase italic">
              {busy ? "Casting Spell..." : "Start Journey!"} <Star size={32} fill="white" />
            </button>
          </form>
          <div className="mt-8 flex items-center gap-4 text-sm font-bold text-blue-300">
            <div className="h-1 flex-1 bg-blue-50" /><span>OR USE MAGIC</span><div className="h-1 flex-1 bg-blue-50" />
          </div>
          <div className="mt-6 flex justify-center gap-6">
            <button onClick={onGoogleLogin} disabled={busy} className="group flex flex-col items-center gap-2">
              <div className="rounded-full bg-white p-4 shadow-lg border-4 border-blue-50 group-hover:scale-110 transition-transform">
                <Image src="/google-icon.svg" width={30} height={30} alt="G" />
              </div>
              <span className="text-xs font-black text-blue-900">GOOGLE</span>
            </button>
          </div>
        </div>
        <p className="mt-10 text-center text-xl font-black text-blue-950/60">Already a Hero? <Link href="/login" className="text-blue-500 underline underline-offset-8">Portal In!</Link></p>
      </div>
    </section>
  );
}