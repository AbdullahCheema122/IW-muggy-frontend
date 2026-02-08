import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ensureUserDoc } from "@/lib/ensureUserDoc";

export type StickerShopItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  rarity?: string;
};

export type BookItem = {
  id: string; // unique placed item id
  stickerId: string;
  x: number; // 0..1
  y: number; // 0..1
  s: number; // scale
  r: number; // rotation degrees
  z: number; // z index order
};

export const DEFAULT_PAGES = ["page-1", "page-2", "page-3"];

function uidOrThrow(user: any) {
  const uid = user?.uid;
  if (!uid) throw new Error("Not signed in");
  return uid;
}

export async function buySticker(user: any, stickerId: string) {
  const uid = uidOrThrow(user);
  await ensureUserDoc(user);

  const userRef = doc(db, "users", uid);
  const shopRef = doc(db, "sticker_shop", stickerId);
  const invRef = doc(db, "users", uid, "inventory", stickerId);

  await runTransaction(db, async (tx) => {
    const [userSnap, shopSnap, invSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(shopRef),
      tx.get(invRef),
    ]);

    if (!shopSnap.exists()) throw new Error("Sticker not found in shop.");
    const price = Number((shopSnap.data() as any)?.price || 0);

    const stars = Number((userSnap.data() as any)?.stars || 0);
    if (stars < price) throw new Error("Not enough stars.");

    tx.update(userRef, {
      stars: increment(-price),
      lastActive: serverTimestamp(),
    });

    if (invSnap.exists()) {
      tx.update(invRef, { qty: increment(1) });
    } else {
      tx.set(invRef, { qty: 1, unlockedAt: serverTimestamp() }, { merge: true });
    }
  });
}

export async function placeStickerOnPage(user: any, opts: {
  pageId: string;
  stickerId: string;
  x: number;
  y: number;
}) {
  const uid = uidOrThrow(user);
  await ensureUserDoc(user);

  const invRef = doc(db, "users", uid, "inventory", opts.stickerId);
  const pageRef = doc(db, "users", uid, "sticker_book", opts.pageId);

  await runTransaction(db, async (tx) => {
    const [invSnap, pageSnap] = await Promise.all([tx.get(invRef), tx.get(pageRef)]);

    const qty = invSnap.exists() ? Number((invSnap.data() as any)?.qty || 0) : 0;
    if (qty <= 0) throw new Error("You don’t own this sticker.");

    // decrement inventory
    tx.update(invRef, { qty: increment(-1) });

    // add item to page
    const prevItems: BookItem[] = pageSnap.exists() ? ((pageSnap.data() as any)?.items || []) : [];
    const nextZ = prevItems.length ? Math.max(...prevItems.map((i) => i.z ?? 0)) + 1 : 1;

    const item: BookItem = {
      id: `item_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      stickerId: opts.stickerId,
      x: clamp01(opts.x),
      y: clamp01(opts.y),
      s: 1.0,
      r: 0,
      z: nextZ,
    };

    if (pageSnap.exists()) {
      tx.update(pageRef, {
        items: [...prevItems, item],
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.set(
        pageRef,
        {
          items: [item],
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  });
}

export async function ensureBookPagesExist(user: any) {
  const uid = uidOrThrow(user);
  await ensureUserDoc(user);

  // create missing pages with empty items
  await Promise.all(
    DEFAULT_PAGES.map(async (pageId) => {
      const ref = doc(db, "users", uid, "sticker_book", pageId);
      const snap = await getDoc(ref);
      if (snap.exists()) return;
      await setDoc(
        ref,
        { items: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true }
      );
    })
  );
}

export async function cleanupZeroQtyInventory(user: any, stickerId: string) {
  // optional: if qty hits 0 you can delete doc; not required
  const uid = uidOrThrow(user);
  const invRef = doc(db, "users", uid, "inventory", stickerId);
  const snap = await getDoc(invRef);
  if (!snap.exists()) return;
  const qty = Number((snap.data() as any)?.qty || 0);
  if (qty <= 0) {
    await updateDoc(invRef, { qty: 0 }); // keep doc stable; or deleteDoc if you prefer
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
