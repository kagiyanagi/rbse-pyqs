"use client";

import { useState } from "react";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "./avatar";
import { AuthModal } from "./auth-modal";
import { ProfileModal } from "./profile-modal";
import { useAuth } from "./auth-context";
import { usePfp, useProfileName } from "@/hooks/use-pfp";

export function AuthButton() {
  const { user, loading, configured, signOut } = useAuth();
  const [profileName] = useProfileName();
  const [pfp] = usePfp();
  const [signInOpen, setSignInOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!configured) return null;

  if (loading) {
    return <div className="h-8 w-8" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setSignInOpen(true)}>
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">Sign in</span>
        </Button>
        <AuthModal open={signInOpen} onOpenChange={setSignInOpen} />
      </>
    );
  }

  const fallback = user.displayName ?? user.email ?? "";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full outline-none transition-transform active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Account"
          >
            <Avatar
              pfp={pfp}
              firstName={profileName.firstName}
              lastName={profileName.lastName}
              fallback={fallback}
              size={32}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium leading-tight">
              {[profileName.firstName, profileName.lastName].filter(Boolean).join(" ") ||
                user.displayName ||
                "Signed in"}
            </div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            <UserIcon className="h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
