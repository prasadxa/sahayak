import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// API routes are never redirected: they answer 401 themselves, and Convex
// Auth's `/api/auth` proxy is handled by the wrapper before this handler runs.
const isApiRoute = createRouteMatcher(["/api", "/api/(.*)", "/trpc", "/trpc/(.*)"]);

// Pages reachable without signing in.
const isPublicPage = createRouteMatcher([
  "/login",
  "/register",
  "/track",
  "/track/(.*)",
  "/manifest.webmanifest",
  "/icons/(.*)",
]);

const isAuthPage = createRouteMatcher(["/login", "/register"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (isApiRoute(request)) return;

    if (isAuthPage(request)) {
      if (await convexAuth.isAuthenticated()) {
        return nextjsMiddlewareRedirect(request, "/");
      }
      return;
    }

    if (!isPublicPage(request) && !(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/login");
    }
  },
  // Passed explicitly so the auth proxy doesn't warn about an undefined URL.
  { convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL }
);

export const config = {
  // Convex Auth's recommended matcher: every route except static files and
  // Next internals, plus `/` and all API routes.
  matcher: ["/((?!.*\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
