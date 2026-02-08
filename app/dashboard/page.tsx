/* ============================================================
   DashboardPage.tsx (FULL FILE)
   + Adds a simple "Spend Stars" cosmetic shop
   + Saves purchase to Firestore
   + Sets equipped cosmetic
   + Updates visuals immediately in SessionView (because SessionView listens to equipped)
============================================================ */
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Star, Trophy, Users, Sparkles, ScrollText, Rocket, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  setDoc,
  increment,
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
      equipped: {},
      inventory: {},
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    },
    { merge: true }
  );
}

/* ---------------------------
   Star Burst + Coin Shower
--------------------------- */
function StarBurst({ add }: { add: number }) {
  const stars = [
    { x: -70, y: -55, r: -18, s: 1.0 },
    { x: 70, y: -55, r: 16, s: 0.95 },
    { x: -75, y: 55, r: 12, s: 0.9 },
    { x: 75, y: 55, r: -10, s: 0.92 },
  ];

  return (
    <motion.div className="fixed inset-0 pointer-events-none z-[999]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="absolute top-8 right-8 bg-yellow-300 text-yellow-900 border-4 border-white rounded-full px-4 py-2 font-black shadow-lg"
        initial={{ scale: 0.4, y: -10, opacity: 0 }}
        animate={{ scale: 1.05, y: 0, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 18 }}
      >
        +{add} STARS!
      </motion.div>

      {stars.map((p, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2"
          initial={{ x: 0, y: 0, scale: 0.2, rotate: 0, opacity: 0 }}
          animate={{ x: p.x, y: p.y, scale: p.s, rotate: p.r, opacity: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.02 * i }}
        >
          <motion.div initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ duration: 0.9, ease: "easeInOut" }}>
            <Star size={64} className="text-yellow-400" fill="currentColor" />
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function CoinShower({ add }: { add: number }) {
  const count = Math.max(12, Math.min(34, 14 + Math.floor(add / 2)));
  const [h, setH] = React.useState<number>(900);

  React.useEffect(() => {
    setH(window.innerHeight || 900);
  }, []);

  const coins = React.useMemo(() => {
    const arr: any[] = [];
    for (let i = 0; i < count; i++) {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.25;
      const duration = 1.0 + Math.random() * 0.9;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720);
      const drift = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 60);
      const size = 10 + Math.random() * 16;
      const opacity = 0.85 + Math.random() * 0.15;
      arr.push({ left, delay, duration, spin, drift, size, opacity, key: i });
    }
    return arr;
  }, [count]);

  return (
    <motion.div className="fixed inset-0 pointer-events-none z-[998]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {coins.map((c) => (
        <motion.div
          key={c.key}
          className="absolute top-0"
          style={{ left: `${c.left}%`, opacity: c.opacity }}
          initial={{ y: -50, x: 0, rotate: 0, scale: 0.8 }}
          animate={{ y: h + 80, x: c.drift, rotate: c.spin, scale: 1 }}
          transition={{ delay: c.delay, duration: c.duration, ease: "easeIn" }}
        >
          <div
            className="rounded-full border-2 border-white shadow-[0_8px_0_rgba(0,0,0,0.08)]"
            style={{
              width: c.size,
              height: c.size,
              background:
                "radial-gradient(circle at 30% 30%, #FFF6A5 0%, #FFD54A 35%, #F6A700 75%, #C77800 100%)",
            }}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ---------------------------
   Simple cosmetic shop catalog
--------------------------- */
const SHOP_ITEMS = [
  {
    id: "skin_gold",
    type: "skin",
    title: "Golden Muggy",
    price: 50,
    badge: "Legendary",
    previewStyle: "bg-gradient-to-br from-yellow-200 via-yellow-400 to-amber-600",
  },
  {
    id: "steam_sparkle",
    type: "steam",
    title: "Sparkle Steam",
    price: 25,
    badge: "Epic",
    previewStyle: "bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500",
  },
  {
    id: "skin_space",
    type: "skin",
    title: "Space Muggy",
    price: 40,
    badge: "Epic",
    previewStyle: "bg-gradient-to-br from-[#0B1026] via-[#1E1B4B] to-[#6B5CFF]",
  },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [myStars, setMyStars] = React.useState<number>(0);
  const [myLessons, setMyLessons] = React.useState<number>(0);
  const [myTrophies, setMyTrophies] = React.useState<number>(0);
  const [equipped, setEquipped] = React.useState<any>({});
  const [inventory, setInventory] = React.useState<any>({});

  const prevStarsRef = React.useRef<number>(0);
  const starsInitRef = React.useRef(false);

  const [starBurst, setStarBurst] = React.useState<{ key: number; add: number } | null>(null);
  const [coinShower, setCoinShower] = React.useState<{ key: number; add: number } | null>(null);

  // Online status
  React.useEffect(() => {
    if (!user?.uid) return;
    ensureUserDoc(user).catch(() => {});
    updateDoc(doc(db, "users", user.uid), { lastActive: serverTimestamp() }).catch(() => {});
  }, [user?.uid]);

  // Listen to MY user doc
  React.useEffect(() => {
    if (!user?.uid) return;

    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.exists() ? (snap.data() as any) : {};
      const nextStars = Number(data?.stars || 0);
      const nextLessons = Number(data?.lessons || 0);
      const nextTrophies = Number(data?.trophies || 0);

      setEquipped(data?.equipped || {});
      setInventory(data?.inventory || {});

      if (!starsInitRef.current) {
        starsInitRef.current = true;
        prevStarsRef.current = nextStars;
      } else {
        const prev = prevStarsRef.current;
        if (nextStars > prev) {
          const add = nextStars - prev;
          const k = Date.now();
          setStarBurst({ key: k, add });
          setCoinShower({ key: k + 1, add });
          window.setTimeout(() => setStarBurst(null), 1500);
          window.setTimeout(() => setCoinShower(null), 1700);
        }
        prevStarsRef.current = nextStars;
      }

      setMyStars(nextStars);
      setMyLessons(nextLessons);
      setMyTrophies(nextTrophies);
    });

    return () => unsub();
  }, [user?.uid]);

  // Leaderboard
  React.useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users"), orderBy("stars", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLeaderboard(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsubscribe();
  }, [user]);

  const buyAndEquip = async (item: (typeof SHOP_ITEMS)[number]) => {
    if (!user?.uid) return;
    await ensureUserDoc(user);

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? (snap.data() as any) : {};
    const stars = Number(data?.stars || 0);

    if (stars < item.price) return;

    const nextInventory = { ...(data?.inventory || {}) };
    nextInventory[item.id] = true;

    const nextEquipped = { ...(data?.equipped || {}) };
    nextEquipped[item.type] = item.id;

    await updateDoc(userRef, {
      stars: increment(-item.price),
      inventory: nextInventory,
      equipped: nextEquipped,
      lastActive: serverTimestamp(),
    });
  };

  const equipOnly = async (item: (typeof SHOP_ITEMS)[number]) => {
    if (!user?.uid) return;
    await ensureUserDoc(user);

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? (snap.data() as any) : {};
    const inv = data?.inventory || {};
    if (!inv[item.id]) return;

    const nextEquipped = { ...(data?.equipped || {}) };
    nextEquipped[item.type] = item.id;

    await updateDoc(userRef, {
      equipped: nextEquipped,
      lastActive: serverTimestamp(),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-black text-blue-400 animate-pulse text-2xl uppercase">
        Magic Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E0F7FA] font-[var(--font-comic-sans)] pb-20">
      <AnimatePresence>{starBurst && <StarBurst key={starBurst.key} add={starBurst.add} />}</AnimatePresence>
      <AnimatePresence>{coinShower && <CoinShower key={coinShower.key} add={coinShower.add} />}</AnimatePresence>

      <header className="p-4">
        <div className="mx-auto max-w-7xl flex justify-between items-center bg-white/90 rounded-full px-8 py-3 shadow-xl border-4 border-white">
          <Link href="/" className="flex items-center gap-2 font-black text-blue-900 italic text-xl">
            <Sparkles className="text-pink-500" /> MUGGY DASH
          </Link>
          <Button onClick={() => router.push("/agentstarted")} className="bg-blue-500 rounded-full font-black px-8">
            NEW LESSON
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <h1 className="text-6xl font-black text-blue-950 italic">Hi {user?.displayName || "Hero"}!</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatBubble label="Your Stars" value={myStars} icon={Star} color="bg-yellow-400" />
            <StatBubble label="Lessons" value={myLessons} icon={Rocket} color="bg-blue-400" />
            <StatBubble label="Trophies" value={myTrophies} icon={Trophy} color="bg-pink-400" />
          </div>

          {/* ✅ SHOP */}
          <div className="space-y-5">
            <h2 className="text-3xl font-black text-blue-900 italic flex items-center gap-3">
              <ShoppingBag className="text-pink-500" /> STAR SHOP
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SHOP_ITEMS.map((it) => {
                const owned = !!inventory?.[it.id];
                const equippedNow = equipped?.[it.type] === it.id;

                return (
                  <div key={it.id} className="p-6 rounded-[40px] border-4 border-white bg-white shadow-xl">
                    <div className={cn("h-20 rounded-3xl border-4 border-white shadow-md", it.previewStyle)} />
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-blue-200 uppercase tracking-widest">{it.badge}</div>
                        <div className="text-xl font-black text-blue-900 italic">{it.title}</div>
                      </div>
                      <div className="flex items-center gap-1 font-black text-yellow-700">
                        <Star size={16} fill="currentColor" /> {it.price}
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      {!owned ? (
                        <Button
                          onClick={() => buyAndEquip(it)}
                          className="w-full bg-gradient-to-r from-blue-500 to-pink-500 font-black rounded-full"
                          disabled={myStars < it.price}
                        >
                          BUY + EQUIP
                        </Button>
                      ) : (
                        <Button
                          onClick={() => equipOnly(it)}
                          className={cn(
                            "w-full font-black rounded-full",
                            equippedNow ? "bg-green-500" : "bg-blue-500"
                          )}
                        >
                          {equippedNow ? "EQUIPPED" : "EQUIP"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-black text-blue-900 italic flex items-center gap-3">
              <ScrollText /> RECENT QUESTS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {["Color Master", "Animal Sounds"].map((topic, i) => (
                <div
                  key={i}
                  className="p-6 rounded-[40px] border-4 border-white bg-white shadow-xl hover:-translate-y-2 transition-all"
                >
                  <h3 className="text-xl font-black text-blue-900 mb-2 uppercase italic">{topic}</h3>
                  <div className="h-4 w-full bg-blue-50 rounded-full overflow-hidden border-2 border-white">
                    <div className="h-full bg-pink-400 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <h2 className="text-3xl font-black text-blue-900 italic flex items-center gap-3">
            <Users className="text-pink-500" /> HALL OF HEROES
          </h2>

          <div className="rounded-[40px] border-8 border-white bg-white/60 p-6 shadow-2xl space-y-4 backdrop-blur-sm min-h-[400px]">
            {leaderboard.map((hero, i) => (
              <div
                key={hero.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-3xl bg-white shadow-md border-2",
                  hero.id === user?.uid ? "border-pink-400 bg-pink-50" : "border-blue-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="font-black text-blue-200">#{i + 1}</span>
                  <div className="relative">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-black text-blue-500 uppercase">
                      {hero.displayName?.[0] || "H"}
                    </div>
                    {hero.lastActive && Date.now() - hero.lastActive.toMillis() < 300000 && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
                    )}
                  </div>
                  <span className="font-black text-blue-900 italic uppercase text-xs">{hero.displayName || "Hero"}</span>
                </div>

                <div className="flex items-center gap-1 text-yellow-600 font-black">
                  <Star size={14} fill="currentColor" /> {hero.stars || 0}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

function StatBubble({ label, value, icon: Icon, color }: any) {
  return (
    <div className="relative rounded-[35px] border-4 border-white bg-white p-6 shadow-xl flex flex-col items-center overflow-hidden">
      <div className={cn("mb-3 rounded-2xl p-3 text-white shadow-md", color)}>
        <Icon size={24} />
      </div>

      <div className="text-[10px] font-black text-blue-200 uppercase tracking-widest">{label}</div>

      <motion.div
        key={value}
        initial={{ scale: 0.9, y: 2 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
        className="text-3xl font-black text-blue-900 italic leading-none"
      >
        {value}
      </motion.div>
    </div>
  );
}
