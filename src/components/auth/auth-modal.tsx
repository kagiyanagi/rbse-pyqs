"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "./auth-context";
import { readableAuthError } from "@/lib/firebase/errors";
import { useToast } from "@/components/ui/toaster";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.501 12.27c0-.79-.07-1.555-.2-2.286H12v4.32h5.92c-.255 1.37-1.025 2.532-2.18 3.31v2.747h3.527c2.063-1.9 3.234-4.7 3.234-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.94 0 5.405-.975 7.207-2.64l-3.527-2.745c-.978.65-2.225 1.04-3.68 1.04-2.83 0-5.227-1.91-6.084-4.482H2.27v2.81C4.06 20.45 7.74 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.916 14.173a6.59 6.59 0 010-4.346V7.017H2.27a11.001 11.001 0 000 9.966l3.646-2.81z"
      />
      <path
        fill="#EA4335"
        d="M12 5.397c1.6 0 3.034.55 4.165 1.628l3.13-3.13C17.4 2.06 14.94 1 12 1 7.74 1 4.06 3.55 2.27 7.017l3.646 2.81C6.773 7.307 9.17 5.397 12 5.397z"
      />
    </svg>
  );
}

export function AuthModal({ open, onOpenChange }: Props) {
  const auth = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"" | "google" | "email">("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const close = () => {
    setEmail("");
    setPassword("");
    setErr(null);
    setInfo(null);
    setBusy("");
    onOpenChange(false);
  };

  const onGoogle = async () => {
    setBusy("google");
    setErr(null);
    try {
      await auth.signInWithGoogle();
      close();
    } catch (e) {
      setErr(readableAuthError(e));
    } finally {
      setBusy("");
    }
  };

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("email");
    setErr(null);
    setInfo(null);
    try {
      if (tab === "signup") {
        await auth.signUpWithEmail(email.trim(), password);
        toast.info("Verify your email", `We sent a link to ${email.trim()}.`);
        close();
      } else {
        await auth.signInWithEmail(email.trim(), password);
        close();
      }
    } catch (er) {
      setErr(readableAuthError(er));
    } finally {
      setBusy("");
    }
  };

  const onForgot = async () => {
    if (!email.trim()) {
      setErr("Enter your email above first.");
      return;
    }
    setBusy("email");
    setErr(null);
    setInfo(null);
    try {
      await auth.resetPassword(email.trim());
      setInfo(`Reset link sent to ${email.trim()}`);
      toast.success("Reset email sent", email.trim());
    } catch (er) {
      setErr(readableAuthError(er));
    } finally {
      setBusy("");
    }
  };

  if (!auth.configured) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign-in unavailable</DialogTitle>
            <DialogDescription>
              Firebase isn&apos;t configured for this deploy. Add <code>NEXT_PUBLIC_FIREBASE_*</code> env vars and reload.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tab === "signin" ? "Sign in" : "Create account"}</DialogTitle>
          <DialogDescription>
            Sync bookmarks, notes, and answered questions across devices.
          </DialogDescription>
        </DialogHeader>

        <Button
          variant="outline"
          onClick={onGoogle}
          disabled={busy !== ""}
          className="w-full"
        >
          {busy === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleMark className="h-4 w-4" />
          )}
          Continue with Google
        </Button>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
          <TabsList className="w-full">
            <TabsTrigger value="signin" className="flex-1">Sign in</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">Create account</TabsTrigger>
          </TabsList>

          <form onSubmit={onEmail} className="mt-3 flex flex-col gap-3">
            <TabsContent value="signin" className="m-0 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="signup" className="m-0 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="auth-email-2">Email</Label>
                <Input
                  id="auth-email-2"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-password-2">Password</Label>
                <Input
                  id="auth-password-2"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">At least 6 characters.</p>
              </div>
            </TabsContent>

            {err && <p className="text-xs text-destructive">{err}</p>}
            {info && <p className="text-xs text-emerald-600 dark:text-emerald-400">{info}</p>}

            <Button type="submit" className="w-full" disabled={busy !== ""}>
              {busy === "email" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tab === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>

            {tab === "signin" && (
              <button
                type="button"
                onClick={onForgot}
                className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Forgot password?
              </button>
            )}
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
