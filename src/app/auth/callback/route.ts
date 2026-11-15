import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/home';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/home';
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  // Older (PKCE) links only work in the browser that asked for them. Let /auth/finish try in the
  // browser itself and, if it still fails, show a clear "ask for a new link" screen.
  const to = new URL('/auth/finish', url.origin);
  to.searchParams.set('next', safeNext);
  if (code) to.searchParams.set('code', code);
  return NextResponse.redirect(to);
}
