
"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { ensureUserDoc } from "@/lib/ensureUserDoc";
import {
  DEFAULT_PAGES,
  ensureBookPagesExist,
  placeStickerOnPage,
  type BookItem,
  type StickerShopItem,
} from "@/lib/stickers";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Star, BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type InventoryItem = { id: string; qty: number };

export default function StickerBookPage() {
  const { user } = useAuth();

  const [stars, setStars] = React.useState(0);
  const [pageId, setPageId] = React.useState(DEFAULT_PAGES[0]);
  const [activeStickerId, setActiveStickerId] = React.useState<string | null>(null);

  const [shopMap, setShopMap] = React.useState<Record<string, StickerShopItem>>({});
  const [inventory, setInventory] = React.useState<InventoryItem[]>([]);
  const [pageItems, setPageItems] = React.useState<BookItem[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  const canvasRef = React.useRef<HTMLDivElement | null>(null);

  // Ensure user + pages
  React.useEffect(() => {
    if (!user?.uid) return;
    ensureUserDoc(user).catch(() => {});
    ensureBookPagesExist(user).catch(() => {});
  }, [user?.uid]);

  // Stars live
  React.useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const next = snap.exists() ? Number((snap.data() as any)?.stars || 0) : 0;
      setStars(next);
    });
    return () => unsub();
  }, [user?.uid]);

  // Sticker catalog (for names/images)
  React.useEffect(() => {
    const q = query(collection(db, "sticker_shop"), orderBy("price", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, StickerShopItem> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        map[d.id] = {
          id: d.id,
          name: String(data?.name || d.id),
          price: Number(data?.price || 0),
          imageUrl: String(data?.imageUrl || ""),
          rarity: data?.rarity ? String(data.rarity) : undefined,
        };
      });
      setShopMap(map);
    });
    return () => unsub();
  }, []);

  // Inventory live
  React.useEffect(() => {
    if (!user?.uid) return;
    const invCol = collection(db, "users", user.uid, "inventory");
    const unsub = onSnapshot(invCol, (snap) => {
      const list: InventoryItem[] = snap.docs
        .map((d) => ({ id: d.id, qty: Number((d.data() as any)?.qty || 0) }))
        .filter((x) => x.qty > 0);
      setInventory(list);

      // if currently selected sticker not owned anymore, clear it
      if (activeStickerId && !list.some((x) => x.id === activeStickerId)) {
        setActiveStickerId(null);
      }
    });
    return () => unsub();
  }, [user?.uid, activeStickerId]);

  // Page items live
  React.useEffect(() => {
    if (!user?.uid) return;
    const pageRef = doc(db, "users", user.uid, "sticker_book", pageId);
    const unsub = onSnapshot(pageRef, (snap) => {
      const items = snap.exists() ? ((snap.data() as any)?.items || []) : [];
      setPageItems(items);
    });
    return () => unsub();
  }, [user?.uid, pageId]);

  const handleCanvasClick = async (e: React.MouseEvent) => {
    if (!user?.uid) return;
    setErr(null);

    if (!activeStickerId) {
      setErr("Select a sticker first.");
      return;
    }

    const el = canvasRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    try {
      await placeStickerOnPage(user, { pageId, stickerId: activeStickerId, x, y });
      // keep selected so kid can place multiple quickly
    } catch (err: any) {
      setErr(err?.message || "Could not place sticker.");
    }
  };

  const empty = inventory.length === 0;

  return (
    <div className="min-h-screen bg-[#E0F7FA] font-[var(--font-comic-sans)] pb-24">
      <header className="p-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between bg-white/90 rounded-full px-6 py-3 shadow-xl border-4 border-white">
          <Link href="/dashboard" className="flex items-center gap-2 font-black text-blue-900 italic text-xl">
            <ArrowLeft className="text-pink-500" /> BACK
          </Link>

          <div className="flex items-center gap-2 bg-yellow-100 px-4 py-1 rounded-full border-2 border-yellow-400 text-yellow-700 font-black">
            <Star size={18} fill="currentColor" /> {stars} STARS
          </div>

          <Link
            href="/stickers/shop"
            className="px-5 py-2 rounded-full font-black text-white border-4 border-white shadow-lg bg-gradient-to-br from-[#2B7BFF] via-[#6B5CFF] to-[#FF4FD8]"
          >
            SHOP
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-6">
        <h1 className="text-5xl font-black text-blue-950 italic flex items-center gap-3">
          <BookOpen className="text-pink-500" /> My Sticker Book
        </h1>

        {err && (
          <div className="mt-5 p-4 rounded-[24px] border-4 border-white bg-white shadow-lg font-black text-red-600">
            {err}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
          {/* LEFT: Inventory */}
          <aside className="rounded-[36px] border-4 border-white bg-white/70 shadow-xl p-5">
            <div className="flex items-center justify-between">
              <div className="font-black text-blue-900 italic text-xl flex items-center gap-2">
                <Sparkles className="text-pink-500" /> Stickers
              </div>

              <select
                className="font-black rounded-2xl border-4 border-white bg-white px-3 py-2 shadow"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              >
                {DEFAULT_PAGES.map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 space-y-3">
              {empty && (
                <div className="p-4 rounded-[26px] border-4 border-white bg-white shadow font-black text-blue-900">
                  No stickers yet. Go to the shop and buy your first one.
                </div>
              )}

              {!empty &&
                inventory.map((inv) => {
                  const meta = shopMap[inv.id];
                  const name = meta?.name || inv.id;
                  const img = meta?.imageUrl || "";
                  const active = activeStickerId === inv.id;

                  return (
                    <button
                      key={inv.id}
                      onClick={() => setActiveStickerId(inv.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-[26px] border-4 shadow-lg transition",
                        active
                          ? "border-pink-300 bg-gradient-to-br from-[#2B7BFF] via-[#6B5CFF] to-[#FF4FD8] text-white"
                          : "border-white bg-white text-blue-900"
                      )}
                    >
                      <div className={cn("w-14 h-14 rounded-2xl border-4 border-white bg-blue-50 flex items-center justify-center")}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img ? <img src={img} alt={name} className="w-10 h-10 object-contain" /> : <span>★</span>}
                      </div>

                      <div className="flex-1 text-left">
                        <div className={cn("font-black italic", active ? "text-white" : "text-blue-900")}>{name}</div>
                        <div className={cn("text-xs font-black", active ? "text-white/90" : "text-blue-400")}>
                          Owned: {inv.qty}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="mt-5 p-4 rounded-[26px] border-4 border-white bg-white shadow font-black text-blue-900 text-sm">
              Tip: Select a sticker, then click the page to place it.
            </div>
          </aside>

          {/* RIGHT: Page Canvas */}
          <section>
            <div className="rounded-[40px] border-4 border-white bg-white shadow-2xl p-5">
              <div className="font-black text-blue-900 italic text-xl mb-4">
                {pageId.toUpperCase()}
              </div>

              <div
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={cn(
                  "relative w-full aspect-[4/3] rounded-[34px] border-4 border-white overflow-hidden cursor-crosshair",
                  "bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.9)_0%,rgba(224,247,250,0.9)_35%,rgba(186,230,253,0.9)_100%)]"
                )}
              >
                {/* placed stickers */}
                {pageItems
                  .slice()
                  .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
                  .map((it) => {
                    const meta = shopMap[it.stickerId];
                    const img = meta?.imageUrl || "";
                    const size = 96 * (it.s ?? 1);

                    return (
                      <div
                        key={it.id}
                        className="absolute"
                        style={{
                          left: `${it.x * 100}%`,
                          top: `${it.y * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${it.r ?? 0}deg)`,
                          width: size,
                          height: size,
                          zIndex: it.z ?? 1,
                          pointerEvents: "none",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img ? (
                          <img
                            src={img}
                            alt={meta?.name || it.stickerId}
                            className="w-full h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.15)]"
                          />
                        ) : (
                          <div className="w-full h-full rounded-3xl bg-yellow-200 border-4 border-white shadow-lg flex items-center justify-center font-black">
                            ★
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="font-black text-blue-800">
                  Selected:{" "}
                  <span className="text-pink-600">
                    {activeStickerId ? (shopMap[activeStickerId]?.name || activeStickerId) : "None"}
                  </span>
                </div>

                <Link
                  href="/stickers/shop"
                  className="px-5 py-2 rounded-full font-black text-white border-4 border-white shadow-lg bg-gradient-to-br from-[#2B7BFF] via-[#6B5CFF] to-[#FF4FD8]"
                >
                  BUY MORE
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
