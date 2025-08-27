import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLettaIdentityForUser } from "@/lib/letta-identity";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard/command-center";

  console.log(`[auth/callback] Processing OAuth callback with code: ${code ? "present" : "missing"}`);

  if (code) {
    // Use the server client which handles cookies properly
    const supabase = await createClient();
    
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('[auth/callback] Error exchanging code for session:', error.message);
      const errorRedirect = new URL('/auth/auth-code-error', origin);
      errorRedirect.searchParams.set('error', error.code || 'unknown_error');
      errorRedirect.searchParams.set('error_description', error.message);
      return NextResponse.redirect(errorRedirect);
    }

    // Create or get Letta identity for the user
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log(`[auth/callback] User authenticated: ${user.id}`);
      try {
        await getLettaIdentityForUser(user.id);
      } catch (identityError: any) {
        console.error('[auth/callback] Error creating Letta identity:', identityError.message);
      }
    } else {
      console.log("[auth/callback] No user found after authentication");
    }
    
    return NextResponse.redirect(new URL(next, origin));
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(new URL('/auth/auth-code-error?error_description=No+code+provided', origin));
}
