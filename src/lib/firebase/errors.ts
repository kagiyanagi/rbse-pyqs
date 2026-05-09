const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email looks invalid.",
  "auth/missing-password": "Enter a password.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/email-already-in-use": "An account already exists with this email. Try signing in instead.",
  "auth/invalid-credential": "Wrong email or password.",
  "auth/wrong-password": "Wrong email or password.",
  "auth/user-not-found": "No account with that email.",
  "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  "auth/network-request-failed": "Network problem — check your connection.",
  "auth/popup-closed-by-user": "Sign-in window closed before completion.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and try again.",
  "auth/cancelled-popup-request": "Sign-in cancelled.",
  "auth/credential-already-in-use": "That account is already linked to another user.",
  "auth/provider-already-linked": "That sign-in method is already linked.",
  "auth/no-such-provider": "That sign-in method isn't linked to your account.",
  "auth/requires-recent-login": "For security, sign in again before changing this.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled in Firebase. Check the console.",
};

export function readableAuthError(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = String((err as { code: unknown }).code);
    if (MESSAGES[code]) return MESSAGES[code];
    return code.replace(/^auth\//, "").replace(/-/g, " ");
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
