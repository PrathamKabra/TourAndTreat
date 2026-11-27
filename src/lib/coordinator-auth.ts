import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function getCoordinatorAccess(): Promise<{
  user: User | null;
  hasAccess: boolean;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) return { user: null, hasAccess: false };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  return {
    user,
    hasAccess: profile?.role === 'coordinator' || profile?.role === 'admin',
  };
}
