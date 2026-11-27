import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function redirectWithCookies(url: URL, response: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach(({ name, value, ...options }) => {
    redirectResponse.cookies.set(name, value, options);
  });
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new NextResponse('Authentication is not configured.', { status: 503 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error('Dashboard session lookup failed:', sessionError);
    return new NextResponse('Unable to verify your session. Please try again.', { status: 503 });
  }

  if (!session) {
    const loginUrl = new URL('/auth', request.url);
    loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return redirectWithCookies(loginUrl, response);
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('Dashboard session verification failed:', authError);
    return new NextResponse('Unable to verify your session. Please try again.', { status: 503 });
  }

  if (!user) {
    const loginUrl = new URL('/auth', request.url);
    loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return redirectWithCookies(loginUrl, response);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Dashboard role verification failed:', profileError);
    return new NextResponse('Unable to verify coordinator access. Please try again.', { status: 503 });
  }

  if (profile?.role !== 'coordinator' && profile?.role !== 'admin') {
    return redirectWithCookies(new URL('/patient/dashboard', request.url), response);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*'],
};
