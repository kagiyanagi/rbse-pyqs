"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "./auth-context";
import { useBookmarks, type BookmarksState } from "@/hooks/use-bookmarks";
import { useBookmarkNotes } from "@/hooks/use-bookmark-notes";
import { useAnswered } from "@/hooks/use-answered";
import { useDefaultLanguage, useLanguageOverrides, type LanguageMode } from "@/hooks/use-language";
import {
  GEMINI_MODELS,
  useGeminiModel,
  useHideAnswered,
  usePromptTemplate,
  type GeminiModelId,
} from "@/hooks/use-settings";
import { useTextSize, type TextSize } from "@/hooks/use-text-size";
import { useProfileName } from "@/hooks/use-pfp";
import {
  loadUserData,
  loadUserProfile,
  mergeUserData,
  subscribeUserData,
  subscribeUserProfile,
  writeUserData,
  writeUserProfile,
  type SyncedSettings,
  type UserDataState,
  type UserProfile,
} from "@/lib/firebase/sync";

const DEBOUNCE_MS = 1000;

function readLocalRaw<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function snapshot(state: unknown): string {
  return JSON.stringify(state ?? null);
}

export function SyncBridge() {
  const { user, configured } = useAuth();
  const uid = user?.uid;

  const bookmarks = useBookmarks();
  const notes = useBookmarkNotes();
  const answered = useAnswered();
  const [defaultLanguage, setDefaultLanguage] = useDefaultLanguage();
  const [hideAnswered, setHideAnswered] = useHideAnswered();
  const [geminiModel, setGeminiModel] = useGeminiModel();
  const [promptTemplate, setPromptTemplate] = usePromptTemplate();
  const langOverrides = useLanguageOverrides();
  const textSizeApi = useTextSize();
  const [profileName, setProfileName] = useProfileName();

  // Setters for nested keys (we set localStorage directly to avoid hook coupling)
  const setBookmarksState = (v: BookmarksState) => {
    try {
      window.localStorage.setItem("rbse_bookmarks", JSON.stringify(v));
      window.dispatchEvent(new StorageEvent("storage", { key: "rbse_bookmarks" }));
    } catch {
      // ignore
    }
  };
  const setNotesState = (v: Record<string, string>) => {
    try {
      window.localStorage.setItem("rbse_bookmark_notes", JSON.stringify(v));
      window.dispatchEvent(new StorageEvent("storage", { key: "rbse_bookmark_notes" }));
    } catch {
      // ignore
    }
  };
  const setAnsweredState = (v: number[]) => {
    try {
      window.localStorage.setItem("rbse_answered", JSON.stringify(v));
      window.dispatchEvent(new StorageEvent("storage", { key: "rbse_answered" }));
    } catch {
      // ignore
    }
  };
  const setLangOverridesState = (v: Record<string, LanguageMode>) => {
    try {
      window.localStorage.setItem("rbse_language_overrides", JSON.stringify(v));
      window.dispatchEvent(new StorageEvent("storage", { key: "rbse_language_overrides" }));
    } catch {
      // ignore
    }
  };

  const initialMergeDone = useRef(false);
  const lastSyncedDataRef = useRef<string>("");
  const lastSyncedProfileRef = useRef<string>("");
  const dataDebounceRef = useRef<number | null>(null);
  const profileDebounceRef = useRef<number | null>(null);

  // Apply merged state into the local hooks. Declared before the effects that use it.
  const applyMergedToLocal = (merged: UserDataState) => {
    if (merged.bookmarks) setBookmarksState(merged.bookmarks);
    if (merged.bookmarkNotes) setNotesState(merged.bookmarkNotes);
    if (merged.answered) setAnsweredState(merged.answered);
    const s = merged.settings ?? {};
    if (s.defaultLanguage) setDefaultLanguage(s.defaultLanguage);
    if (typeof s.hideAnswered === "boolean") setHideAnswered(s.hideAnswered);
    if (s.geminiModel && GEMINI_MODELS.some((m) => m.id === s.geminiModel))
      setGeminiModel(s.geminiModel);
    if (typeof s.promptTemplate === "string") setPromptTemplate(s.promptTemplate);
    if (s.textSize && typeof s.textSize === "object") textSizeApi.set(s.textSize as TextSize);
    if (s.languageOverrides) setLangOverridesState(s.languageOverrides);
  };

  // Reset on user change
  useEffect(() => {
    initialMergeDone.current = false;
    lastSyncedDataRef.current = "";
    lastSyncedProfileRef.current = "";
    if (dataDebounceRef.current) {
      window.clearTimeout(dataDebounceRef.current);
      dataDebounceRef.current = null;
    }
    if (profileDebounceRef.current) {
      window.clearTimeout(profileDebounceRef.current);
      profileDebounceRef.current = null;
    }
  }, [uid]);

  // Initial merge + remote subscription
  useEffect(() => {
    if (!configured || !uid) return;

    let cancelled = false;
    let unsubData: (() => void) | null = null;
    let unsubProfile: (() => void) | null = null;

    (async () => {
      // ----- userdata -----
      try {
        const remote = (await loadUserData(uid)) ?? undefined;
        if (cancelled) return;

        const local: UserDataState = {
          bookmarks: readLocalRaw<BookmarksState>("rbse_bookmarks"),
          bookmarkNotes: readLocalRaw<Record<string, string>>("rbse_bookmark_notes"),
          answered: readLocalRaw<number[]>("rbse_answered"),
          settings: {
            defaultLanguage: readLocalRaw<LanguageMode>("defaultLanguage"),
            hideAnswered: readLocalRaw<boolean>("hideAnswered"),
            geminiModel: readLocalRaw<GeminiModelId>("geminiModel"),
            promptTemplate: readLocalRaw<string>("promptTemplate"),
            textSize: readLocalRaw<TextSize>("rbse_text_size"),
            languageOverrides: readLocalRaw<Record<string, LanguageMode>>("rbse_language_overrides"),
          },
        };

        const merged = mergeUserData(local, remote);
        applyMergedToLocal(merged);
        await writeUserData(uid, merged);
        lastSyncedDataRef.current = snapshot(merged);
        initialMergeDone.current = true;
      } catch (e) {
        console.warn("[sync] userdata initial merge failed", e);
      }

      if (cancelled) return;
      unsubData = subscribeUserData(uid, (data, fromServer) => {
        if (!fromServer || !data) return;
        const local: UserDataState = {
          bookmarks: readLocalRaw<BookmarksState>("rbse_bookmarks"),
          bookmarkNotes: readLocalRaw<Record<string, string>>("rbse_bookmark_notes"),
          answered: readLocalRaw<number[]>("rbse_answered"),
          settings: {
            defaultLanguage: readLocalRaw<LanguageMode>("defaultLanguage"),
            hideAnswered: readLocalRaw<boolean>("hideAnswered"),
            geminiModel: readLocalRaw<GeminiModelId>("geminiModel"),
            promptTemplate: readLocalRaw<string>("promptTemplate"),
            textSize: readLocalRaw<TextSize>("rbse_text_size"),
            languageOverrides: readLocalRaw<Record<string, LanguageMode>>(
              "rbse_language_overrides",
            ),
          },
        };
        const merged = mergeUserData(local, data);
        const sig = snapshot(merged);
        if (sig === lastSyncedDataRef.current) return;
        applyMergedToLocal(merged);
        lastSyncedDataRef.current = sig;
      });

      // ----- profile (firstName / lastName) -----
      try {
        const remoteProfile = (await loadUserProfile(uid)) ?? undefined;
        if (cancelled) return;

        const localProfile: UserProfile = {
          firstName: readLocalRaw<{ firstName: string; lastName: string }>("rbse_profile_name")
            ?.firstName,
          lastName: readLocalRaw<{ firstName: string; lastName: string }>("rbse_profile_name")
            ?.lastName,
        };

        const merged: UserProfile = {
          firstName:
            (localProfile.firstName && localProfile.firstName.trim()) ||
            remoteProfile?.firstName ||
            "",
          lastName:
            (localProfile.lastName && localProfile.lastName.trim()) ||
            remoteProfile?.lastName ||
            "",
        };
        // If neither side had names, optionally seed from displayName
        if (!merged.firstName && user?.displayName) {
          const parts = user.displayName.trim().split(/\s+/);
          merged.firstName = parts[0] ?? "";
          merged.lastName = parts.slice(1).join(" ");
        }

        setProfileName({ firstName: merged.firstName ?? "", lastName: merged.lastName ?? "" });
        await writeUserProfile(uid, merged);
        lastSyncedProfileRef.current = snapshot(merged);
      } catch (e) {
        console.warn("[sync] profile initial merge failed", e);
      }

      if (cancelled) return;
      unsubProfile = subscribeUserProfile(uid, (profile, fromServer) => {
        if (!fromServer || !profile) return;
        const sig = snapshot({ firstName: profile.firstName ?? "", lastName: profile.lastName ?? "" });
        if (sig === lastSyncedProfileRef.current) return;
        setProfileName({
          firstName: profile.firstName ?? "",
          lastName: profile.lastName ?? "",
        });
        lastSyncedProfileRef.current = sig;
      });
    })();

    return () => {
      cancelled = true;
      if (unsubData) unsubData();
      if (unsubProfile) unsubProfile();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, uid]);

  // Push local changes → Firestore (debounced)
  useEffect(() => {
    if (!configured || !uid || !initialMergeDone.current) return;

    const data: UserDataState = {
      bookmarks: bookmarks.state,
      bookmarkNotes: Object.fromEntries(
        notes.ids.map((id) => [String(id), notes.get(id)] as const),
      ),
      answered: answered.ids,
      settings: {
        defaultLanguage,
        hideAnswered,
        geminiModel,
        promptTemplate,
        textSize: textSizeApi.size,
        languageOverrides: langOverrides.overrides,
      } satisfies SyncedSettings,
    };

    const sig = snapshot(data);
    if (sig === lastSyncedDataRef.current) return;

    if (dataDebounceRef.current) window.clearTimeout(dataDebounceRef.current);
    dataDebounceRef.current = window.setTimeout(() => {
      void writeUserData(uid, data).catch((e) => console.warn("[sync] write userdata failed", e));
      lastSyncedDataRef.current = sig;
    }, DEBOUNCE_MS);

    return () => {
      if (dataDebounceRef.current) window.clearTimeout(dataDebounceRef.current);
    };
  }, [
    configured,
    uid,
    bookmarks.state,
    notes.ids,
    notes,
    answered.ids,
    defaultLanguage,
    hideAnswered,
    geminiModel,
    promptTemplate,
    textSizeApi.size,
    langOverrides.overrides,
  ]);

  // Push profile name changes → Firestore (debounced)
  useEffect(() => {
    if (!configured || !uid) return;
    const merged: UserProfile = {
      firstName: profileName.firstName ?? "",
      lastName: profileName.lastName ?? "",
    };
    const sig = snapshot(merged);
    if (sig === lastSyncedProfileRef.current) return;
    if (!lastSyncedProfileRef.current) return; // wait for initial merge

    if (profileDebounceRef.current) window.clearTimeout(profileDebounceRef.current);
    profileDebounceRef.current = window.setTimeout(() => {
      void writeUserProfile(uid, merged).catch((e) =>
        console.warn("[sync] write profile failed", e),
      );
      lastSyncedProfileRef.current = sig;
    }, DEBOUNCE_MS);

    return () => {
      if (profileDebounceRef.current) window.clearTimeout(profileDebounceRef.current);
    };
  }, [configured, uid, profileName.firstName, profileName.lastName]);

  return null;
}
