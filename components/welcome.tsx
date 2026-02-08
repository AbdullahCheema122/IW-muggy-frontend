"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import {
  Star,
  Zap,
  Gamepad2,
  Trophy,
  Rocket,
  Cloud,
  Sparkles,
  Heart,
  MessageCircle,
} from "lucide-react";

import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ---------------------------
   Firestore: ensure user doc exists
--------------------------- */
async function ensureUserDoc(u: any) {
  if (!u?.uid) return;
  const userRef = doc(db, "users", u.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return;

  await setDoc(
    userRef,
    {
      uid: u.uid,
      displayName: u.displayName || "Hero",
      email: u.email || "",
      photoURL: u.photoURL || "",
      stars: 0,
      lessons: 0,
      trophies: 0,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    },
    { merge: true }
  );
}

/* -----------------------------------
   Fantasy Backdrop
----------------------------------- */
function FantasyBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#E0F7FA] to-[#B2EBF2]">
      <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-yellow-200 blur-3xl opacity-40" />

      <motion.div
        animate={{ x: [-20, 20, -20], y: [0, 10, 0] }}
        transition={{ duration: 12, repeat: Infinity }}
        className="absolute top-20 left-[10%] text-white opacity-60"
      >
        <Cloud size={100} fill="currentColor" />
      </motion.div>

      <motion.div
        animate={{ x: [20, -20, 20] }}
        transition={{ duration: 15, repeat: Infinity }}
        className="absolute top-60 right-[15%] text-white opacity-40"
      >
        <Cloud size={140} fill="currentColor" />
      </motion.div>

      <div className="absolute bottom-0 w-full h-24 bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')] opacity-10" />
    </div>
  );
}

/* -----------------------------------
   Playful UI Atoms
----------------------------------- */
function BubbleCard({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "relative rounded-[40px] border-4 border-white bg-white/90 p-6 shadow-[0_12px_0_0_rgba(0,0,0,0.05)] transition-all hover:translate-y-[-4px]",
        className
      )}
    >
      {children}
    </div>
  );
}

function KidButton({ children, onClick, variant = "primary" }: any) {
  const styles: any = {
    primary:
      "bg-[#FF6B6B] hover:bg-[#FF5252] shadow-[0_8px_0_0_#C94C4C] active:shadow-none active:translate-y-[8px]",
    secondary:
      "bg-[#4D96FF] hover:bg-[#3B82F6] shadow-[0_8px_0_0_#3678D9] active:shadow-none active:translate-y-[8px]",
    magic:
      "bg-[#9B72AA] hover:bg-[#815B8E] shadow-[0_8px_0_0_#6A4E75] active:shadow-none active:translate-y-[8px]",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-10 py-5 text-2xl font-black text-white transition-all uppercase tracking-wider italic flex items-center gap-3",
        styles[variant]
      )}
    >
      {children}
    </button>
  );
}

/* -----------------------------------
   Main Landing Component
----------------------------------- */
export const Welcome: React.FC<any> = ({ startButtonText = "Talk to Ms. Muggy!" }) => {
  const { user } = useAuth();
  const router = useRouter();

  const [myStars, setMyStars] = React.useState<number>(0);

  React.useEffect(() => {
    if (!user?.uid) {
      setMyStars(0);
      return;
    }

    ensureUserDoc(user).catch(() => {});
    updateDoc(doc(db, "users", user.uid), { lastActive: serverTimestamp() }).catch(() => {});

    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const next = snap.exists() ? Number((snap.data() as any)?.stars || 0) : 0;
      setMyStars(next);
    });

    return () => unsub();
  }, [user?.uid]);

  return (
    <section className="relative isolate flex min-h-screen flex-col font-[var(--font-comic-sans)] overflow-hidden">
      <FantasyBackdrop />

      {/* Header */}
      <header className="px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full bg-white/95 p-3 shadow-2xl border-4 border-pink-100">
          <Link href="/" className="flex items-center gap-3 px-5">
            <div className="rounded-2xl bg-gradient-to-tr from-blue-400 to-indigo-600 p-2 text-white shadow-lg">
              <Sparkles size={28} />
            </div>
            <span className="text-3xl font-black text-blue-900 tracking-tighter uppercase italic">Ms. Muggy</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <div className="flex items-center gap-2 bg-yellow-100 px-4 py-2 rounded-full border-2 border-yellow-300 text-yellow-700 font-bold">
              <Star size={20} fill="currentColor" /> {myStars} STARS
            </div>

            <KidButton variant="secondary" onClick={() => router.push("/login")}>
              LOGIN
            </KidButton>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="mx-auto grid max-w-7xl px-6 py-12 md:grid-cols-2 items-center gap-16">
        <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} className="space-y-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-pink-100 px-6 py-2 text-lg font-black text-pink-600 border-2 border-pink-200 animate-pulse">
            <Sparkles size={20} /> MS. MUGGY IS READY!
          </div>

          <h1 className="text-6xl font-black leading-[1.1] text-blue-950 md:text-8xl">
            Let&apos;s Talk &{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-orange-500 italic">
              Explore!
            </span>
          </h1>

          <p className="text-2xl font-bold text-blue-800/70 leading-relaxed">
            Ms. Muggy is your magical teacher! Learn new words, solve forest mysteries, and earn shiny stars together.
          </p>

          <div className="flex flex-col gap-8 sm:flex-row items-center">
            <KidButton onClick={() => router.push("/signup")}>
              {startButtonText} <MessageCircle size={28} fill="white" />
            </KidButton>

            <div className="group cursor-pointer flex items-center gap-4 text-blue-900 font-black text-xl hover:text-pink-500 transition-colors">
              <div className="rounded-full bg-white p-4 shadow-xl border-4 border-blue-100 group-hover:scale-110 transition-transform">
                <Gamepad2 className="text-green-500" size={32} />
              </div>
              QUEST LOG
            </div>
          </div>
        </motion.div>

        {/* The MuggyCup Hero Reveal */}
        <motion.div initial={{ scale: 0.8, opacity: 0, rotate: 5 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} className="relative">
          {/* Badge */}
          <div className="absolute -left-8 top-10 z-30 rounded-[20px] bg-yellow-400 p-5 shadow-2xl border-4 border-white transform -rotate-12">
            <div className="flex flex-col items-center gap-1 font-black text-blue-900">
              <Trophy size={40} className="text-white" />
              <span className="text-sm uppercase italic">Teacher</span>
            </div>
          </div>

          <BubbleCard className="p-4 border-[12px] border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden">
            <div className="relative aspect-square overflow-hidden rounded-[30px] bg-gradient-to-b from-blue-300 via-purple-300 to-pink-200">
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  animate={{ y: [0, -20, 0], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="relative w-full h-full flex items-center justify-center"
                >
                  <img src="/Ms Muggy.png" alt="Ms. Muggy" className="w-4/5 h-auto object-contain drop-shadow-2xl" />
                </motion.div>

                <div className="mt-8 bg-white/40 backdrop-blur-md px-8 py-3 rounded-full border-2 border-white/50">
                  <p className="font-black text-blue-900 text-xl tracking-widest uppercase italic">Magic Portal</p>
                </div>
              </div>

              <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(255,255,255,0.4)_100%)] pointer-events-none" />
            </div>
          </BubbleCard>

          <Sparkles className="absolute -bottom-12 -left-10 text-yellow-400 h-20 w-20 animate-spin-slow opacity-60" />
          <Heart className="absolute -top-10 -right-4 text-pink-400 h-16 w-16 animate-bounce" fill="currentColor" />
        </motion.div>
      </div>

      {/* Quest Map Section */}
      <section className="bg-white px-6 py-24 mt-20 relative border-t-[12px] border-blue-100">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-5xl font-black text-blue-950 mb-16 italic">
            START YOUR{" "}
            <span className="underline decoration-[10px] decoration-pink-400 uppercase italic">
              Quest!
            </span>
          </h2>

          <div className="grid gap-12 md:grid-cols-3">
            {[
              { title: "Word Magic", icon: <Rocket size={48} />, color: "bg-orange-100 text-orange-500", desc: "Discover huge new words like 'ENORMOUS'!" },
              { title: "Story Time", icon: <Zap size={48} />, color: "bg-blue-100 text-blue-500", desc: "Tell Ms. Muggy about your day and earn stars." },
              { title: "Solve Mysteries", icon: <Star size={48} />, color: "bg-yellow-100 text-yellow-500", desc: "Find the hidden treasures in the magic forest!" }
            ].map((item, idx) => (
              <div key={idx} className="group cursor-pointer">
                <BubbleCard className="text-center h-full flex flex-col items-center space-y-6 py-12 group-hover:bg-blue-50 transition-colors">
                  <div className={cn("p-6 rounded-[30px] shadow-inner transform group-hover:rotate-12 transition-transform", item.color)}>
                    {item.icon}
                  </div>
                  <h3 className="text-3xl font-black text-blue-950 uppercase italic">{item.title}</h3>
                  <p className="text-lg font-bold text-blue-700/60 leading-relaxed">{item.desc}</p>
                </BubbleCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-16 text-center font-black text-blue-200 bg-[#E0F7FA] border-t-4 border-white">
        <div className="flex justify-center gap-8 mb-4">
          <Heart fill="currentColor" size={24} />
          <Star fill="currentColor" size={24} />
          <Sparkles fill="currentColor" size={24} />
        </div>
        <p className="tracking-[0.2em]">MADE IN THE MAGIC KITCHEN</p>
      </footer>
    </section>
  );
};
