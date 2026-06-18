// Fetches a durable eve session's recorded event stream (replayed from the
// start) so a resumed chat can rebuild its full message history. The stream is
// long-lived, so we read until the backlog is caught up (a session.waiting or
// terminal event) or a timeout, then close it.

// withEve mounts the eve service under this prefix; the eve channel routes live
// at /eve/v1/* beneath it.
const EVE_PREFIX = "/_eve_internal/eve/eve/v1";

export async function fetchSessionEvents(sessionId: string, token: string): Promise<unknown[]> {
  const res = await fetch(`${EVE_PREFIX}/session/${sessionId}/stream?startIndex=0`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok || !res.body) return [];

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events: unknown[] = [];
  let buf = "";
  const start = performance.now();

  try {
    while (performance.now() - start < 12000) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let ev: { type?: string };
        try {
          ev = JSON.parse(trimmed);
        } catch {
          continue;
        }
        events.push(ev);
        // The recorded backlog ends when the session parks or terminates.
        if (
          ev.type === "session.waiting" ||
          ev.type === "session.completed" ||
          ev.type === "session.failed"
        ) {
          return events;
        }
      }
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
  return events;
}
