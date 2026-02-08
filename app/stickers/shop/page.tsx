"use client";

import React from "react";
import Link from "next/link";
import { onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { ensureUserDoc } from "@/lib/ensureUserDoc";
import { buySticker, type StickerShopItem } from "@/lib/stickers";
import { Star, Sparkles, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { doc } from "firebase/firestore";

export default function StickerShopPage() {
  const { user } = useAuth();

  const [stars, setStars] = React.useState(0);
  const [items, setItems] = React.useState<StickerShopItem[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user?.uid) return;
    ensureUserDoc(user).catch(() => {});

    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const next = snap.exists() ? Number((snap.data() as any)?.stars || 0) : 0;
      setStars(next);
    });

    return () => unsub();
  }, [user?.uid]);

  React.useEffect(() => {
    const q = query(collection(db, "sticker_shop"), orderBy("price", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const next: StickerShopItem[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: String(data?.name || d.id),
          price: Number(data?.price || 0),
          imageUrl: String(data?.imageUrl || ""),
          rarity: data?.rarity ? String(data.rarity) : undefined,
        };
      });
      setItems(next);
    });
    return () => unsub();
  }, []);

  const onBuy = async (stickerId: string) => {
    if (!user?.uid) return;
    setErr(null);
    setBusyId(stickerId);
    try {
      await buySticker(user, stickerId);
    } catch (e: any) {
      setErr(e?.message || "Purchase failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#E0F7FA] font-[var(--font-comic-sans)] pb-24">
      <header className="p-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between bg-white/90 rounded-full px-6 py-3 shadow-xl border-4 border-white">
          <Link href="/dashboard" className="flex items-center gap-2 font-black text-blue-900 italic text-xl">
            <ArrowLeft className="text-pink-500" /> BACK
          </Link>

          <div className="flex items-center gap-2 bg-yellow-100 px-4 py-1 rounded-full border-2 border-yellow-400 text-yellow-700 font-black">
            <Star size={18} fill="currentColor" /> {stars} STARS
          </div>

          <Link
            href="/stickers/book"
            className="px-5 py-2 rounded-full font-black text-white border-4 border-white shadow-lg bg-gradient-to-br from-[#2B7BFF] via-[#6B5CFF] to-[#FF4FD8]"
          >
            STICKER BOOK
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pt-8">
        <h1 className="text-5xl font-black text-blue-950 italic flex items-center gap-3">
          <Sparkles className="text-pink-500" /> Sticker Shop
        </h1>

        {err && (
          <div className="mt-5 p-4 rounded-[24px] border-4 border-white bg-white shadow-lg font-black text-red-600">
            {err}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => (
            <div key={it.id} className="rounded-[36px] border-4 border-white bg-white shadow-xl p-6">
              <div className="flex items-center justify-between">
                <div className="font-black text-blue-900 italic text-lg">{it.name}</div>
                <div className="flex items-center gap-1 text-yellow-700 font-black">
                  <Star size={16} fill="currentColor" /> {it.price}
                </div>
              </div>

              <div className="mt-4 rounded-[28px] border-4 border-white bg-blue-50 p-4 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.imageUrl}
                  alt={it.name}
                  className="w-28 h-28 object-contain drop-shadow"
                />
              </div>

              <button
                disabled={busyId === it.id}
                onClick={() => onBuy(it.id)}
                className={cn(
                  "mt-5 w-full rounded-[22px] px-5 py-3 font-black border-4 border-white shadow-lg",
                  busyId === it.id
                    ? "bg-gray-300 text-gray-600"
                    : "text-white bg-gradient-to-br from-[#2B7BFF] via-[#6B5CFF] to-[#FF4FD8]"
                )}
              >
                {busyId === it.id ? "BUYING..." : "BUY"}
              </button>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="mt-10 p-6 rounded-[30px] border-4 border-white bg-white shadow-xl font-black text-blue-900">
            No stickers found. Create docs in <span className="text-pink-600">sticker_shop</span>.
          </div>
        )}
      </main>
    </div>
  );
}
