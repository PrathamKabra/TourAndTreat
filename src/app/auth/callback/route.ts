import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/patient/dashboard';
  }

  return value;
}

export async function GET(request: NextRequest) {
  const callbackUrl = new URL(request.url);
  const code = callbackUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/auth?authError=confirmation', callbackUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/auth?authError=confirmation', callbackUrl.origin));
  }

  return NextResponse.redirect(
    new URL(getSafeNextPath(callbackUrl.searchParams.get('next')), callbackUrl.origin)
  );
}
