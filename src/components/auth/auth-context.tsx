"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  unlink,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

export type AuthMethod = "google.com" | "password";

type AuthState = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  methods: AuthMethod[];
};

type AuthApi = AuthState & {
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  linkGoogle: () => Promise<void>;
  linkEmailPassword: (email: string, password: string) => Promise<void>;
  unlinkMethod: (method: AuthMethod) => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
};

const AuthCtx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const tickRef = useRef(0);
  const [, force] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(firebaseAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const refresh = useCallback(() => {
    tickRef.current++;
    force(tickRef.current);
  }, []);

  const methods: AuthMethod[] = useMemo(() => {
    if (!user) return [];
    return user.providerData
      .map((p) => p.providerId)
      .filter((id): id is AuthMethod => id === "google.com" || id === "password");
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(firebaseAuth(), provider);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // best-effort; don't block sign-up
    }
  }, []);

  const signInWithEmailFn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth(), email, password);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(firebaseAuth(), email);
  }, []);

  const resendVerification = useCallback(async () => {
    const u = firebaseAuth().currentUser;
    if (!u) throw new Error("Not signed in");
    await sendEmailVerification(u);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(firebaseAuth());
  }, []);

  const linkGoogle = useCallback(async () => {
    const u = firebaseAuth().currentUser;
    if (!u) throw new Error("Not signed in");
    await linkWithPopup(u, new GoogleAuthProvider());
    await u.reload();
    refresh();
  }, [refresh]);

  const linkEmailPassword = useCallback(
    async (email: string, password: string) => {
      const u = firebaseAuth().currentUser;
      if (!u) throw new Error("Not signed in");
      const cred = EmailAuthProvider.credential(email, password);
      await linkWithCredential(u, cred);
      try {
        if (!u.emailVerified) await sendEmailVerification(u);
      } catch {
        // ignore
      }
      await u.reload();
      refresh();
    },
    [refresh],
  );

  const unlinkMethod = useCallback(
    async (method: AuthMethod) => {
      const u = firebaseAuth().currentUser;
      if (!u) throw new Error("Not signed in");
      const linked = u.providerData.map((p) => p.providerId);
      if (!linked.includes(method)) throw new Error("That method isn't linked.");
      if (linked.length <= 1) throw new Error("Can't unlink your only sign-in method.");
      await unlink(u, method);
      await u.reload();
      refresh();
    },
    [refresh],
  );

  const changePassword = useCallback(
    async (newPassword: string, currentPassword?: string) => {
      const u = firebaseAuth().currentUser;
      if (!u) throw new Error("Not signed in");
      try {
        await updatePassword(u, newPassword);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code !== "auth/requires-recent-login") throw err;
        if (currentPassword && u.email) {
          const cred = EmailAuthProvider.credential(u.email, currentPassword);
          await reauthenticateWithCredential(u, cred);
        } else {
          // Re-auth via Google popup as a fallback
          await reauthenticateWithPopup(u, new GoogleAuthProvider());
        }
        await updatePassword(u, newPassword);
      }
    },
    [],
  );

  const updateDisplayName = useCallback(async (name: string) => {
    const u = firebaseAuth().currentUser;
    if (!u) throw new Error("Not signed in");
    await updateProfile(u, { displayName: name || null });
    await u.reload();
    refresh();
  }, [refresh]);

  const api: AuthApi = useMemo(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      methods,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail: signInWithEmailFn,
      resetPassword,
      resendVerification,
      signOut,
      linkGoogle,
      linkEmailPassword,
      unlinkMethod,
      changePassword,
      updateDisplayName,
    }),
    [
      user,
      loading,
      methods,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmailFn,
      resetPassword,
      resendVerification,
      signOut,
      linkGoogle,
      linkEmailPassword,
      unlinkMethod,
      changePassword,
      updateDisplayName,
    ],
  );

  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
