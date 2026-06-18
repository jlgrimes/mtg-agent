"use client";

import { useCallback, useEffect, useState } from "react";

interface DeckSummary {
  id: number;
  name: string;
  size: number;
  colors: string[];
  bracket: number | null;
  private: boolean;
  unlisted: boolean;
  featured: string | null;
}

export interface PickedDeck {
  name: string;
  decklistText: string;
  commanders: string[];
}

const COLOR_DOT: Record<string, string> = {
  W: "bg-amber-200",
  U: "bg-blue-400",
  B: "bg-neutral-700",
  R: "bg-red-500",
  G: "bg-green-500",
};

// Soft gradient fallback (keyed off color identity) when a deck has no cover art.
const COLOR_HEX: Record<string, string> = {
  W: "#e3c75f",
  U: "#3b82f6",
  B: "#3f3f46",
  R: "#ef4444",
  G: "#22c55e",
};
function fallbackGradient(colors: string[]): string {
  const hex = (colors.length ? colors : ["B"]).map((c) => COLOR_HEX[c] ?? "#71717a");
  const stops = hex.length === 1 ? [hex[0], "#27272a"] : hex;
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}

// Home-screen Archidekt deck picker: connect once, then click a deck to make it
// the active context for the chat. Lives on the empty/home view, not the sidebar.
export function DeckPicker({ onSelect }: { readonly onSelect: (deck: PickedDeck) => void }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);

  const loadDecks = useCallback(async () => {
    setLoadingDecks(true);
    setError(null);
    try {
      const res = await fetch("/api/archidekt/decks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load decks.");
      setDecks(data.decks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load decks.");
    } finally {
      setLoadingDecks(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/archidekt/status");
        const data = await res.json();
        setConnected(Boolean(data.connected));
        setUsername(data.username ?? null);
        if (data.connected) await loadDecks();
      } catch {
        setConnected(false);
      }
    })();
  }, [loadDecks]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/archidekt/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Connection failed.");
      setConnected(true);
      setUsername(data.username);
      setShowForm(false);
      setIdentifier("");
      setPassword("");
      await loadDecks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await fetch("/api/archidekt/disconnect", { method: "POST" });
    setConnected(false);
    setUsername(null);
    setDecks([]);
  };

  const handlePick = async (deck: DeckSummary) => {
    if (pickingId) return;
    setPickingId(deck.id);
    setError(null);
    try {
      const res = await fetch(`/api/archidekt/decks/${deck.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load deck.");
      onSelect({
        name: data.name ?? deck.name,
        decklistText: data.decklistText ?? "",
        commanders: data.commanders ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deck.");
    } finally {
      setPickingId(null);
    }
  };

  if (connected === null) return null;

  // --- Not connected: a quiet prompt that expands into the login form ---
  if (!connected) {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        {showForm ? (
          <form className="flex w-full max-w-sm flex-col gap-2" onSubmit={handleConnect}>
            <p className="text-center text-muted-foreground text-xs leading-relaxed">
              Connect Archidekt to browse and analyze your decks (private ones included). Your
              password is used once to get a token and is never stored.
            </p>
            <input
              autoComplete="username"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Archidekt username or email"
              type="text"
              value={identifier}
            />
            <input
              autoComplete="current-password"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />
            <button
              className="rounded-md bg-foreground px-3 py-2 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={connecting || !identifier || !password}
              type="submit"
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
            <button
              className="text-muted-foreground text-xs hover:text-foreground"
              onClick={() => setShowForm(false)}
              type="button"
            >
              Cancel
            </button>
            {error ? <p className="text-center text-destructive text-xs">{error}</p> : null}
          </form>
        ) : (
          <button
            className="rounded-full border border-border px-4 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setShowForm(true)}
            type="button"
          >
            🔗 Connect Archidekt to load your decks
          </button>
        )}
      </div>
    );
  }

  // --- Connected: pick a deck (cover-art gallery) ---
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span>
          Your decks · <span className="text-foreground">{username}</span>
        </span>
        <button className="hover:text-foreground" onClick={handleDisconnect} type="button">
          (disconnect)
        </button>
      </div>

      {loadingDecks ? (
        <p className="text-muted-foreground text-xs">Loading decks…</p>
      ) : error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : decks.length === 0 ? (
        <p className="text-muted-foreground text-xs">No Commander decks found.</p>
      ) : (
        <div className="grid max-h-[19rem] w-full grid-cols-2 gap-3 overflow-y-auto p-0.5 sm:grid-cols-3">
          {decks.map((deck) => (
            <button
              className="group relative aspect-[16/11] overflow-hidden rounded-xl border border-border bg-muted shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
              disabled={pickingId !== null}
              key={deck.id}
              onClick={() => handlePick(deck)}
              type="button"
            >
              {deck.featured ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                  src={deck.featured}
                />
              ) : (
                <span
                  className="absolute inset-0"
                  style={{ background: fallbackGradient(deck.colors) }}
                />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              {deck.bracket || deck.private || deck.unlisted ? (
                <span className="absolute top-1.5 right-1.5 rounded-md bg-black/45 px-1.5 py-0.5 font-medium text-[10px] text-white/90 backdrop-blur-sm">
                  {deck.private ? "private" : deck.unlisted ? "unlisted" : `B${deck.bracket}`}
                </span>
              ) : null}
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-2 text-left">
                <span className="line-clamp-2 font-semibold text-[13px] text-white leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                  {deck.name}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    {(deck.colors.length ? deck.colors : ["C"]).map((c, i) => (
                      <span
                        className={`size-2 rounded-full ring-1 ring-white/80 ${COLOR_DOT[c] ?? "bg-neutral-400"}`}
                        key={`${c}-${i}`}
                      />
                    ))}
                  </span>
                  <span className="font-mono text-[9px] text-white/80">{deck.size} cards</span>
                </span>
              </span>
              {pickingId === deck.id ? (
                <span className="absolute inset-0 grid place-items-center bg-black/40 text-white text-xs">
                  Loading…
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
