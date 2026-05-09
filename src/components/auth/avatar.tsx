"use client";

import { cn } from "@/lib/utils";
import { colorFor, initialsFor } from "@/lib/avatar";

type Props = {
  pfp?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fallback?: string | null;
  size?: number;
  className?: string;
};

export function Avatar({ pfp, firstName, lastName, fallback, size = 32, className }: Props) {
  const initials = initialsFor(firstName, lastName, fallback);
  const seed = `${firstName ?? ""}${lastName ?? ""}${fallback ?? ""}` || "anon";
  const { bg, fg } = colorFor(seed);
  const fontSize = Math.round(size * 0.42);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full ring-1 ring-foreground/10",
        !pfp && bg,
        !pfp && fg,
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {pfp ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pfp} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-semibold leading-none" style={{ fontSize }}>
          {initials}
        </span>
      )}
    </span>
  );
}
