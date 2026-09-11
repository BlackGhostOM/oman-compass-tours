"use client";

import { useEffect, useState } from "react";

const KEY = "oct_session";

function generate(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return "s_" + Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 30);
}

/** Stable anonymous session key (booking drafts, chat). Persists in localStorage. */
export function useSessionKey(): string | null {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    try {
      let k = window.localStorage.getItem(KEY);
      if (!k) {
        k = generate();
        window.localStorage.setItem(KEY, k);
      }
      setKey(k);
    } catch {
      setKey(generate());
    }
  }, []);
  return key;
}
