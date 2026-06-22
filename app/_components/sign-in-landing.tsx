"use client";

import { SignInButton } from "@clerk/nextjs";
import { AGENT_NAME, AGENT_TAGLINE } from "./chat-view";

export function SignInLanding() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-medium text-4xl tracking-tighter sm:text-5xl">{AGENT_NAME}</h1>
        <p className="text-muted-foreground text-sm">{AGENT_TAGLINE}</p>
      </div>
      <p className="max-w-sm text-muted-foreground text-sm">
        Sign in to analyze your decks, get upgrade recommendations, and find spicy cards for your
        commander.
      </p>
      <SignInButton mode="modal">
        <button
          className="rounded-full bg-foreground px-6 py-2.5 font-medium text-background text-sm transition-opacity hover:opacity-90"
          type="button"
        >
          Sign in to start
        </button>
      </SignInButton>
    </main>
  );
}
