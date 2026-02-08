import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  RoleplayTemplate,
  RoleplayInstance,
  NewRoleplayInstance,
} from "./types";

const TEMPLATES = "roleplayTemplates";
const INSTANCES = "roleplayInstances";

export async function saveTemplate(
  input: Omit<RoleplayTemplate, "id" | "createdAt" | "updatedAt"> & { id?: string },
) {
  if (input.id) {
    const { id, ...rest } = input;
    await setDoc(
      doc(db, TEMPLATES, id),
      {
        ...rest,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return id;
  }
  const ref = await addDoc(collection(db, TEMPLATES), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getPublicTemplates(orgOnly?: boolean, ownerId?: string) {
  const q = query(collection(db, TEMPLATES), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as RoleplayTemplate[];

  // simplistic filter: return owner’s + public; if orgOnly, include org
  return all.filter((t) =>
    ownerId && orgOnly
      ? t.visibility === "org" || t.ownerId === ownerId
      : t.visibility === "public" || t.ownerId === ownerId
  );
}

export async function getTemplate(id: string) {
  const d = await getDoc(doc(db, TEMPLATES, id));
  if (!d.exists()) return null;
  return { id: d.id, ...(d.data() as any) } as RoleplayTemplate;
}

export async function createInstance(opts: {
  template: RoleplayTemplate;
  userId: string;
  variables: Record<string, string>;
}) {
  const snapshot = { ...opts.template };
  delete (snapshot as any).id;
  delete (snapshot as any).createdAt;
  delete (snapshot as any).updatedAt;

  const payload: NewRoleplayInstance = {
    templateId: opts.template.id,
    templateSnapshot: snapshot,
    createdBy: opts.userId,
    variables: opts.variables,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, INSTANCES), payload);
  return ref.id;
}

export async function getInstance(id: string) {
  const d = await getDoc(doc(db, INSTANCES, id));
  if (!d.exists()) return null;
  return { id: d.id, ...(d.data() as any) } as RoleplayInstance;
}
