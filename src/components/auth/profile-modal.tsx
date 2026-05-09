"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Trash2,
  Unlink,
} from "lucide-react";
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
import { Avatar } from "./avatar";
import { AvatarCropper } from "./avatar-cropper";
import { useAuth, type AuthMethod } from "./auth-context";
import { useProfileName, usePfp } from "@/hooks/use-pfp";
import { readableAuthError } from "@/lib/firebase/errors";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const METHOD_LABELS: Record<AuthMethod, string> = {
  "google.com": "Google",
  password: "Email & password",
};

export function ProfileModal({ open, onOpenChange }: Props) {
  const auth = useAuth();
  const [profileName, setProfileName] = useProfileName();
  const [pfp, setPfp] = usePfp();

  const [firstName, setFirstName] = useState(profileName.firstName);
  const [lastName, setLastName] = useState(profileName.lastName);
  const [savingName, setSavingName] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [nameOk, setNameOk] = useState(false);

  const [pickFile, setPickFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [linking, setLinking] = useState<AuthMethod | null>(null);
  const [linkErr, setLinkErr] = useState<string | null>(null);

  const [showAddPwd, setShowAddPwd] = useState(false);
  const [addPwd, setAddPwd] = useState("");
  const [addPwd2, setAddPwd2] = useState("");

  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifySent, setVerifySent] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFirstName(profileName.firstName);
    setLastName(profileName.lastName);
    setNameErr(null);
    setNameOk(false);
    setLinkErr(null);
    setShowAddPwd(false);
    setAddPwd("");
    setAddPwd2("");
    setVerifySent(false);
  }, [open, profileName.firstName, profileName.lastName]);

  if (!auth.user) return null;

  const u = auth.user;
  const methods = auth.methods;
  const hasGoogle = methods.includes("google.com");
  const hasPassword = methods.includes("password");
  const onlyMethod = methods.length <= 1;
  const seedFallback = u.displayName ?? u.email ?? "";

  const saveName = async () => {
    const f = firstName.trim();
    if (!f) {
      setNameErr("First name is required.");
      return;
    }
    setSavingName(true);
    setNameErr(null);
    setNameOk(false);
    try {
      setProfileName({ firstName: f, lastName: lastName.trim() });
      const display = [f, lastName.trim()].filter(Boolean).join(" ");
      await auth.updateDisplayName(display);
      setNameOk(true);
    } catch (e) {
      setNameErr(readableAuthError(e));
    } finally {
      setSavingName(false);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (f) setPickFile(f);
  };

  const linkGoogle = async () => {
    setLinking("google.com");
    setLinkErr(null);
    try {
      await auth.linkGoogle();
    } catch (e) {
      setLinkErr(readableAuthError(e));
    } finally {
      setLinking(null);
    }
  };

  const linkPassword = async () => {
    setLinkErr(null);
    if (!u.email) {
      setLinkErr("Your account doesn't have an email yet — sign in with Google first.");
      return;
    }
    if (addPwd.length < 6) {
      setLinkErr("Password should be at least 6 characters.");
      return;
    }
    if (addPwd !== addPwd2) {
      setLinkErr("Passwords don't match.");
      return;
    }
    setLinking("password");
    try {
      await auth.linkEmailPassword(u.email, addPwd);
      setShowAddPwd(false);
      setAddPwd("");
      setAddPwd2("");
    } catch (e) {
      setLinkErr(readableAuthError(e));
    } finally {
      setLinking(null);
    }
  };

  const doUnlink = async (m: AuthMethod) => {
    if (!confirm(`Remove ${METHOD_LABELS[m]} sign-in from this account?`)) return;
    setLinking(m);
    setLinkErr(null);
    try {
      await auth.unlinkMethod(m);
    } catch (e) {
      setLinkErr(readableAuthError(e));
    } finally {
      setLinking(null);
    }
  };

  const resendVerify = async () => {
    setVerifyBusy(true);
    try {
      await auth.resendVerification();
      setVerifySent(true);
    } catch {
      // ignore
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>
            Display details. Profile picture is stored only on this device.
          </DialogDescription>
        </DialogHeader>

        {!u.emailVerified && hasPassword && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="mt-px h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p>Email not verified. Check {u.email} for a link.</p>
              <button
                type="button"
                onClick={resendVerify}
                disabled={verifyBusy || verifySent}
                className="mt-1 underline-offset-2 hover:underline disabled:opacity-60"
              >
                {verifySent ? "Sent — check your inbox" : verifyBusy ? "Sending…" : "Resend verification email"}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {/* Avatar block */}
          <div className="flex items-center gap-4">
            <Avatar
              pfp={pfp}
              firstName={firstName}
              lastName={lastName}
              fallback={seedFallback}
              size={64}
            />
            <div className="flex flex-1 flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                {pfp ? "Change photo" : "Upload photo"}
              </Button>
              {pfp && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Remove profile picture?")) setPfp("");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
            </div>
          </div>

          {pickFile && (
            <div className="rounded-md border bg-muted/30 p-3">
              <AvatarCropper
                file={pickFile}
                onCancel={() => setPickFile(null)}
                onSave={(dataUrl) => {
                  setPfp(dataUrl);
                  setPickFile(null);
                }}
              />
            </div>
          )}

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">
                First name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">
                Last name <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          {nameErr && <p className="-mt-2 text-xs text-destructive">{nameErr}</p>}
          <div className="-mt-2 flex items-center gap-2">
            <Button size="sm" onClick={saveName} disabled={savingName}>
              {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save name"}
            </Button>
            {nameOk && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>

          {/* Sign-in methods */}
          <div className="space-y-2">
            <Label>Sign-in methods</Label>
            <p className="text-xs text-muted-foreground">
              Keep at least two linked so you&apos;re never locked out.
            </p>
            <div className="space-y-2">
              <MethodRow
                label="Google"
                detail={u.email ?? ""}
                linked={hasGoogle}
                busy={linking === "google.com"}
                disableUnlink={onlyMethod}
                onLink={linkGoogle}
                onUnlink={() => doUnlink("google.com")}
              />

              {hasPassword ? (
                <MethodRow
                  label="Email & password"
                  detail={u.email ?? ""}
                  linked
                  busy={linking === "password"}
                  disableUnlink={onlyMethod}
                  onLink={() => undefined}
                  onUnlink={() => doUnlink("password")}
                />
              ) : showAddPwd ? (
                <div className="rounded-md border p-3">
                  <Label className="text-xs">Add a password for {u.email ?? "this account"}</Label>
                  <div className="mt-2 grid gap-2">
                    <Input
                      type="password"
                      placeholder="New password"
                      autoComplete="new-password"
                      value={addPwd}
                      onChange={(e) => setAddPwd(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      value={addPwd2}
                      onChange={(e) => setAddPwd2(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowAddPwd(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={linkPassword} disabled={linking === "password"}>
                        {linking === "password" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Add password"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <MethodRow
                  label="Email & password"
                  detail="Add a password for recovery"
                  linked={false}
                  busy={false}
                  disableUnlink={false}
                  onLink={() => setShowAddPwd(true)}
                  onUnlink={() => undefined}
                />
              )}
            </div>
            {linkErr && <p className="text-xs text-destructive">{linkErr}</p>}
          </div>

          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await auth.signOut();
                onOpenChange(false);
              }}
              className="w-full justify-start"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MethodRow({
  label,
  detail,
  linked,
  busy,
  disableUnlink,
  onLink,
  onUnlink,
}: {
  label: string;
  detail: string;
  linked: boolean;
  busy: boolean;
  disableUnlink: boolean;
  onLink: () => void;
  onUnlink: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{detail || (linked ? "Linked" : "Not linked")}</p>
      </div>
      {linked ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onUnlink}
          disabled={busy || disableUnlink}
          title={disableUnlink ? "Add another method first" : "Unlink"}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
          Unlink
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={onLink} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
          Link
        </Button>
      )}
    </div>
  );
}
