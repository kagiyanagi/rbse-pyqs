"use client";

import { useLocalStorage } from "./use-local-storage";

export function usePfp() {
  return useLocalStorage<string>("rbse_pfp", "");
}

export function useProfileName() {
  return useLocalStorage<{ firstName: string; lastName: string }>("rbse_profile_name", {
    firstName: "",
    lastName: "",
  });
}
