import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { firebaseDb } from "./client";
import type { BookmarksState } from "@/hooks/use-bookmarks";
import type { LanguageMode } from "@/hooks/use-language";
import type { GeminiModelId } from "@/hooks/use-settings";

export type SyncedSettings = {
  defaultLanguage?: LanguageMode;
  hideAnswered?: boolean;
  geminiModel?: GeminiModelId;
  promptTemplate?: string;
  textSize?: unknown;
  languageOverrides?: Record<string, LanguageMode>;
};

export type UserDataState = {
  bookmarks?: BookmarksState;
  bookmarkNotes?: Record<string, string>;
  answered?: number[];
  settings?: SyncedSettings;
};

export type UserProfile = {
  firstName?: string;
  lastName?: string;
};

export const userDocRef = (uid: string) => doc(firebaseDb(), "users", uid);
export const userDataDocRef = (uid: string) => doc(firebaseDb(), "users", uid, "userdata", "state");

export async function loadUserData(uid: string): Promise<UserDataState | null> {
  const snap = await getDoc(userDataDocRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as UserDataState;
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function writeUserData(uid: string, data: UserDataState): Promise<void> {
  await setDoc(
    userDataDocRef(uid),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function writeUserProfile(uid: string, profile: UserProfile): Promise<void> {
  await setDoc(
    userDocRef(uid),
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export function subscribeUserData(
  uid: string,
  onChange: (data: UserDataState | null, fromServer: boolean) => void,
) {
  return onSnapshot(
    userDataDocRef(uid),
    { includeMetadataChanges: true },
    (snap) => {
      const fromServer = !snap.metadata.hasPendingWrites;
      const data = snap.exists() ? (snap.data() as DocumentData as UserDataState) : null;
      onChange(data, fromServer);
    },
  );
}

export function subscribeUserProfile(
  uid: string,
  onChange: (profile: UserProfile | null, fromServer: boolean) => void,
) {
  return onSnapshot(
    userDocRef(uid),
    { includeMetadataChanges: true },
    (snap) => {
      const fromServer = !snap.metadata.hasPendingWrites;
      const data = snap.exists() ? (snap.data() as DocumentData as UserProfile) : null;
      onChange(data, fromServer);
    },
  );
}

// ---------- merge helpers ----------

export function mergeBookmarks(
  a: BookmarksState | undefined,
  b: BookmarksState | undefined,
): BookmarksState {
  const aCats = a?.categories ?? [];
  const bCats = b?.categories ?? [];
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const c of [...aCats, ...bCats]) {
    if (!seen.has(c)) {
      seen.add(c);
      categories.push(c);
    }
  }
  const byCategory: Record<string, number[]> = {};
  for (const c of categories) {
    const setIds = new Set<number>([
      ...(a?.byCategory?.[c] ?? []),
      ...(b?.byCategory?.[c] ?? []),
    ]);
    byCategory[c] = Array.from(setIds);
  }
  return { categories, byCategory };
}

export function mergeNotes(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) {
    const cur = out[k];
    if (!cur || cur.trim() === "") out[k] = v;
    else if (!v || v.trim() === "") continue;
    else if (v.length > cur.length) out[k] = v;
  }
  return out;
}

export function mergeAnswered(a: number[] | undefined, b: number[] | undefined): number[] {
  const setIds = new Set<number>([...(a ?? []), ...(b ?? [])]);
  return Array.from(setIds);
}

export function mergeSettings(
  local: SyncedSettings | undefined,
  remote: SyncedSettings | undefined,
): SyncedSettings {
  // Remote wins for non-undefined values; falls back to local.
  // This treats Firestore as the source of truth on subsequent loads,
  // but local seeds the initial value when remote has nothing.
  return {
    defaultLanguage: remote?.defaultLanguage ?? local?.defaultLanguage,
    hideAnswered: remote?.hideAnswered ?? local?.hideAnswered,
    geminiModel: remote?.geminiModel ?? local?.geminiModel,
    promptTemplate: remote?.promptTemplate ?? local?.promptTemplate,
    textSize: remote?.textSize ?? local?.textSize,
    languageOverrides: {
      ...(local?.languageOverrides ?? {}),
      ...(remote?.languageOverrides ?? {}),
    },
  };
}

export function mergeUserData(
  local: UserDataState | undefined,
  remote: UserDataState | undefined,
): UserDataState {
  return {
    bookmarks: mergeBookmarks(local?.bookmarks, remote?.bookmarks),
    bookmarkNotes: mergeNotes(local?.bookmarkNotes, remote?.bookmarkNotes),
    answered: mergeAnswered(local?.answered, remote?.answered),
    settings: mergeSettings(local?.settings, remote?.settings),
  };
}
