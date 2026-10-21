"use client";

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// Renders a link only for signed-in MyPetID admins (profiles.is_admin or tier
// 'admin'). Customers see nothing. This only hides UI; admin data and actions are
// protected by the server routes and database policies.
export function AdminOnlyLink({ href, children }: { href: string; children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user.id;
      if (!userId || !supabase) return;
      const { data: profile } = await supabase.from('profiles').select('is_admin,tier').eq('id', userId).maybeSingle();
      if (!cancelled) setIsAdmin(Boolean(profile && (profile.is_admin || profile.tier === 'admin')));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return isAdmin ? <Link className="button" href={href}>{children}</Link> : null;
}
