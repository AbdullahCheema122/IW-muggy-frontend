"use client";

import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  OAuthProvider,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase"; // Added db
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"; // Added Firestore methods
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Star, Sparkles, Heart, Mail, Lock, ArrowRight } from "lucide-react";

/* -----------------------------------
   Kid-Friendly Backdrop
----------------------------------- */
function FantasyBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#E0F7FA] to-[#B2EBF2]">
      <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-yellow-200 blur-3xl opacity-40" />
      <div className="absolute top-40 left-20 opacity-30 animate-bounce"><Star size={60} fill="#FFD700" className="text-yellow-400" /></div>
      <div className="absolute bottom-20 right-20 opacity-20"><Heart size={80} fill="#FF69B4" className="text-pink-400" /></div>
    </div>
  );
}

function KidInput({ label, icon: Icon, ...props }: any) {
  return (
    <div className="space-y-2 w-full">
      <label className="text-lg font-black text-blue-900 ml-4 flex items-center gap-2">
        <Icon size={18} className="text-pink-500" /> {label}
      </label>
      <input
        {...props}
        className="w-full rounded-full border-4 border-white bg-white/80 px-6 py-4 text-lg font-bold text-blue-900 shadow-inner outline-none focus:ring-4 focus:ring-blue-200 transition-all placeholder:text-blue-300"
      />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/dashboard"); // Redirect to dashboard, not home
    });
    return unsub;
  }, [router]);

  // Ensures the Hero exists in Firestore to prevent "Permission Denied"
  async function ensureHeroRecord(user: any) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || "Explorer",
        email: user.email,
        stars: 0, 
        lastActive: serverTimestamp(),
        createdAt: serverTimestamp(),
        photoURL: user.photoURL || ""
      });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      await ensureHeroRecord(cred.user);
      router.replace("/dashboard");
    } catch (e: any) {
      setErr("Oops! Muggy couldn't find your key. Try again!");
    } finally {
      setBusy(false);
    }
  }

  async function handleSocialLogin(provider: any) {
    setBusy(true);
    try {
      const result = await signInWithPopup(auth, provider);
      await ensureHeroRecord(result.user);
      router.replace("/dashboard");
    } catch (error) {
      setErr("Magic portal failed!");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center p-6 font-[var(--font-comic-sans)]">
      <FantasyBackdrop />

      <div className="w-full max-w-lg">
        <Link href="/" className="mb-8 flex flex-col items-center gap-2 group">
          <div className="rounded-3xl bg-white p-4 shadow-xl border-4 border-pink-200 group-hover:rotate-12 transition-transform">
            <Image src="/analysis/Logo3.png" alt="MuggyTalk" width={60} height={60} />
          </div>
          <span className="text-3xl font-black text-blue-900 italic tracking-tighter">MUGGY TALK</span>
        </Link>

        <div className="relative rounded-[40px] border-[12px] border-white bg-white/90 p-8 shadow-2xl backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-blue-900 uppercase italic">Welcome Back!</h1>
            <p className="text-lg font-bold text-blue-700/60 mt-1">Ready for your next quest?</p>
          </div>

          {err && (
            <div className="mb-6 rounded-2xl bg-red-100 border-2 border-red-200 p-4 text-red-600 font-black text-center">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <KidInput 
                label="Muggy Mail" 
                icon={Mail} 
                type="email" 
                placeholder="hero@magic.com" 
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                required
            />
            
            <KidInput 
                label="Secret Key" 
                icon={Lock} 
                type="password" 
                placeholder="••••••••" 
                value={pass}
                onChange={(e: any) => setPass(e.target.value)}
                required
            />

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[#FF6B6B] py-5 text-2xl font-black text-white shadow-[0_8px_0_0_#C94C4C] transition-all hover:bg-[#FF5252] active:translate-y-[8px] active:shadow-none flex items-center justify-center gap-3 uppercase italic"
            >
              {busy ? "Opening Portal..." : "Let's Go!"} <ArrowRight size={28} />
            </button>
          </form>

          <div className="mt-10 grid grid-cols-2 gap-4">
             <button onClick={() => handleSocialLogin(new GoogleAuthProvider())} className="flex items-center justify-center gap-2 rounded-2xl border-4 border-white bg-white p-3 font-black text-blue-900 shadow-md hover:scale-105 transition-transform">
                <Image src="/google-icon.svg" width={20} height={20} alt="G" /> Google
             </button>
             <button onClick={() => handleSocialLogin(new OAuthProvider("microsoft.com"))} className="flex items-center justify-center gap-2 rounded-2xl border-4 border-white bg-white p-3 font-black text-blue-900 shadow-md hover:scale-105 transition-transform">
                <Image src="/ms-icon.svg" width={20} height={20} alt="MS" /> Microsoft
             </button>
          </div>
        </div>

        <p className="mt-8 text-center text-xl font-black text-blue-900/60">
          New Explorer?{" "}
          <Link href="/signup" className="text-pink-500 underline decoration-4 underline-offset-8">
            Start Here!
          </Link>
        </p>
      </div>
    </section>
  );
}