import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// SAFE: never overwrites stars if user doc already exists
export async function ensureUserDoc(u: any) {
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
