import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match everything except Next.js internals, API-ish paths, and files with an extension
  // (favicon.ico, images, etc.) — none of those should get a locale prefix.
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
