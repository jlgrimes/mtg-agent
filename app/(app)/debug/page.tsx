"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

const BUILD = "debug-4"; // bump when re-deploying so the page proves it's fresh

// Self-serve diagnostics: runs the exact authenticated agent flow the chat
// uses (Clerk token -> POST /eve/v1/session -> event stream) and prints every
// raw status/body. Screenshot-friendly replacement for DevTools spelunking.
export default function DebugPage() {
  const { getToken } = useAuth();
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const log = (line: string) => setLines((prev) => [...prev, line]);

  const run = async () => {
    setLines([]);
    setRunning(true);
    try {
      log(`build: ${BUILD} · ${new Date().toISOString()}`);
      log(`origin: ${window.location.origin}`);

      const token = await getToken();
      log(`clerk token: ${token ? `present (${token.slice(0, 12)}…)` : "MISSING"}`);
      const headers: Record<string, string> = {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      };

      const health = await fetch("/eve/v1/health");
      log(`GET /eve/v1/health -> ${health.status} :: ${(await health.text()).slice(0, 120)}`);

      const info = await fetch("/eve/v1/info", { headers });
      log(`GET /eve/v1/info -> ${info.status} :: ${(await info.text()).slice(0, 160)}`);

      // Control probes that discriminate routing theories:
      // - unknown 2-segment path: JSON => host regex catch-all reaches the
      //   service; HTML => only exact literal paths are routed.
      // - fake-session stream: JSON ("Session not found.") => parameterized
      //   routes reach the service; HTML => they're dropped at routing.
      for (const probe of [
        "/eve/v1/definitely-not-a-route",
        "/eve/v1/session/wrun_FAKE_DIAGNOSTIC_ID/stream",
      ]) {
        const r = await fetch(probe, { headers });
        const body = (await r.text()).slice(0, 120).replace(/\s+/g, " ");
        log(`GET ${probe} -> ${r.status} (${r.headers.get("content-type") ?? "?"})`);
        log(`  body: ${body}`);
      }

      const post = await fetch("/eve/v1/session", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "Diagnostic ping. Reply with the single word: pong" }),
      });
      const postText = await post.text();
      log(`POST /eve/v1/session -> ${post.status}`);
      log(`  body: ${postText.slice(0, 300).replace(/\s+/g, " ")}`);

      let sessionId: string | undefined;
      try {
        sessionId = (JSON.parse(postText) as { sessionId?: string }).sessionId;
      } catch {
        log("  (body is not JSON — see above)");
      }
      if (!sessionId) return;

      log(`GET /eve/v1/session/${sessionId}/stream …`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        const stream = await fetch(`/eve/v1/session/${sessionId}/stream`, {
          headers,
          signal: controller.signal,
        });
        log(`  stream -> ${stream.status} (${stream.headers.get("content-type") ?? "?"})`);
        if (!stream.ok || !stream.body) {
          log(`  body: ${(await stream.text()).slice(0, 300).replace(/\s+/g, " ")}`);
          return;
        }
        const reader = stream.body.getReader();
        const decoder = new TextDecoder();
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          received += chunk.length;
          for (const eventLine of chunk.split("\n")) {
            const trimmed = eventLine.trim();
            if (!trimmed) continue;
            // Surface the event type + any error info; full text for failures.
            if (/failed|error/i.test(trimmed)) {
              log(`  EVENT: ${trimmed.slice(0, 500)}`);
            } else {
              const type = /"type"\s*:\s*"([^"]+)"/.exec(trimmed)?.[1] ?? trimmed.slice(0, 60);
              log(`  event: ${type}`);
            }
          }
          if (received > 20_000) {
            log("  (truncated)");
            break;
          }
        }
        log("  stream ended.");
      } catch (e) {
        log(`  stream error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      log(`FATAL: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <button
        className="w-fit rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm disabled:opacity-50"
        disabled={running}
        onClick={run}
        type="button"
      >
        {running ? "Running…" : "Run agent diagnostics"}
      </button>
      <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5">
        {lines.join("\n")}
      </pre>
    </div>
  );
}
