"use client";

import { useState, useEffect } from "react";
import { createClient } from "@dropitx/shared/supabase/client";

export function useAuthUser() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return user;
}
