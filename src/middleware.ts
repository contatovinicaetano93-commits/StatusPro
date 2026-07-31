import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ROLES, type Role } from "@/domain/roles";
import { canAccessPath, homePathForRole } from "@/domain/access";
import { AUTH_COOKIE, resolveAuthSecret } from "@/lib/auth-secret";

const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  if (pathname === "/") {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(new URL(homePathForRole(session.role), request.url));
  }

  if (isPublic) {
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL(homePathForRole(session.role), request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (!canAccessPath(session.role, pathname)) {
    return NextResponse.redirect(new URL(homePathForRole(session.role), request.url));
  }

  return NextResponse.next();
}

async function verifyToken(token: string): Promise<{ role: Role } | null> {
  const secret = resolveAuthSecret();
  if (!secret) {
    // Fail-closed: never verify with a hard-coded production fallback.
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = String(payload.role);
    if (!ROLES.includes(role as Role)) return null;
    return { role: role as Role };
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
