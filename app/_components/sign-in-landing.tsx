"use client";

import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { SignInButton } from "@clerk/nextjs";
import { AGENT_NAME, AGENT_TAGLINE } from "./chat-view";

export function SignInLanding() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-medium text-4xl tracking-tighter sm:text-5xl">{AGENT_NAME}</h1>
        <Text color="secondary" size="sm">
          {AGENT_TAGLINE}
        </Text>
      </div>
      <p className="max-w-sm text-muted-foreground text-sm">
        Sign in to analyze your decks, get upgrade recommendations, and find spicy cards for your
        commander.
      </p>
      <SignInButton mode="modal">
        <Button label="Sign in to start" size="lg" variant="primary" />
      </SignInButton>
    </main>
  );
}
