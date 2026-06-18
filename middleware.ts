import { clerkMiddleware } from "@clerk/nextjs/server";

// Attaches Clerk auth context to the app. It does NOT force sign-in by itself —
// the UI gates the chat with <SignedIn>/<SignedOut>, and the eve channel enforces
// auth on the agent routes. We exclude `_eve_internal` so the eve service proxy
// (mounted by withEve) is never wrapped by the middleware.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Run on app routes, skipping Next internals, the eve service, and static files.
    "/((?!_next|_eve_internal|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
