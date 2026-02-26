// @ts-nocheck
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (images, etc.)
     * - api routes that don't need auth (cron, webhooks)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api/cron|api/geocode).*)",
  ],
};
