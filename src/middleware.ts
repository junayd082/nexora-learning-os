import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from '@/lib/supabase/env';

// Refreshes the Supabase session cookie on every request and routes a stray
// email-confirmation ?code= to the auth callback.
export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (url.pathname === '/' && url.searchParams.get('code')) {
    const to = url.clone();
    to.pathname = '/auth/callback';
    return NextResponse.redirect(to);
  }
  let res = NextResponse.next({ request: req });
  if (!isConfigured) return res;
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|experiences/|.*\\.(?:png|jpg|svg|pdf|webp)$).*)'],
};
