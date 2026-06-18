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
}

interface PickedDeck {
  name: string;
  decklistText: string;
  commanders: string[];
}

const COLOR_DOT: Record<string, string> = {
  W: "bg-amber-200",
  U: "bg-blue-400",
  B: "bg-neutral-600",
  R: "bg-red-500",
  G: "bg-green-500",
};

export function DeckSidebar({
  onPickDeck,
  busy,
}: {
  readonly onPickDeck: (deck: PickedDeck) => void;
  readonly busy: boolean;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // connect form
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
    if (busy || pickingId) return;
    setPickingId(deck.id);
    setError(null);
    try {
      const res = await fetch(`/api/archidekt/decks/${deck.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load deck.");
      onPickDeck({
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

  return (
    <aside className="flex h-dvh w-72 shrink-0 flex-col border-border border-r bg-muted/20">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-medium text-sm">My Decks</span>
        {connected ? (
          <button
            className="text-muted-foreground text-xs hover:text-foreground"
            onClick={handleDisconnect}
            type="button"
          >
            Disconnect
          </button>
        ) : null}
      </div>

      {connected ? (
        <p className="px-4 pb-2 text-muted-foreground text-xs">
          Archidekt: <span className="text-foreground">{username}</span>
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {connected === null ? (
          <p className="px-2 py-4 text-muted-foreground text-xs">Loading…</p>
        ) : connected ? (
          <DeckList
            decks={decks}
            error={error}
            loading={loadingDecks}
            onPick={handlePick}
            pickingId={pickingId}
          />
        ) : (
          <form className="flex flex-col gap-2 px-2 pt-2" onSubmit={handleConnect}>
            <p className="pb-1 text-muted-foreground text-xs leading-relaxed">
              Connect your Archidekt account to browse and analyze your decks (including private
              ones). Your password is used once to get a token and is never stored.
            </p>
            <input
              autoComplete="username"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-foreground/40"
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Archidekt username or email"
              type="text"
              value={identifier}
            />
            <input
              autoComplete="current-password"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-foreground/40"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />
            <button
              className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={connecting || !identifier || !password}
              type="submit"
            >
              {connecting ? "Connecting…" : "Connect Archidekt"}
            </button>
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
          </form>
        )}
      </div>
    </aside>
  );
}

function DeckList({
  decks,
  loading,
  error,
  pickingId,
  onPick,
}: {
  readonly decks: DeckSummary[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly pickingId: number | null;
  readonly onPick: (deck: DeckSummary) => void;
}) {
  if (loading) return <p className="px-2 py-4 text-muted-foreground text-xs">Loading decks…</p>;
  if (error) return <p className="px-2 py-4 text-destructive text-xs">{error}</p>;
  if (decks.length === 0)
    return <p className="px-2 py-4 text-muted-foreground text-xs">No Commander decks found.</p>;

  return (
    <ul className="flex flex-col gap-0.5">
      {decks.map((deck) => (
        <li key={deck.id}>
          <button
            className="flex w-full flex-col items-start gap-1 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
            disabled={pickingId !== null}
            onClick={() => onPick(deck)}
            type="button"
          >
            <span className="flex w-full items-center gap-2">
              <span className="flex gap-0.5">
                {(deck.colors.length ? deck.colors : ["C"]).map((c, i) => (
                  <span
                    className={`size-2 rounded-full ${COLOR_DOT[c] ?? "bg-neutral-400"}`}
                    key={`${c}-${i}`}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{deck.name}</span>
              {pickingId === deck.id ? (
                <span className="text-muted-foreground text-xs">…</span>
              ) : null}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <span>{deck.size} cards</span>
              {deck.bracket ? <span>· B{deck.bracket}</span> : null}
              {deck.private ? <span>· private</span> : deck.unlisted ? <span>· unlisted</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
