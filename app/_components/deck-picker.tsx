"use client";

import { Button } from "@astryxdesign/core/Button";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useCallback, useEffect, useState } from "react";

export interface DeckSummary {
  id: string;
  name: string;
  size: number;
  colors: string[];
  bracket: number | null;
  private: boolean;
  unlisted: boolean;
  featured: string | null;
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

function syncedLabel(ts: number | null): string {
  if (!ts) return "not synced";
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "synced just now";
  if (min < 60) return `synced ${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `synced ${hr}h ago`;
  return `synced ${Math.round(hr / 24)}d ago`;
}

// Home-screen Archidekt deck picker: connect once, then click a deck to open its
// deck page. Lives on the empty/home view, not the sidebar.
export function DeckPicker({ onPick }: { readonly onPick: (deck: DeckSummary) => void }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);

  // Pull fresh decks from Archidekt into our store, then show them.
  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/decks/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setDecks(data.decks ?? []);
      setSyncedAt(data.syncedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }, []);

  // Decks always come from OUR store; if it's empty (first run), sync once.
  const loadDecks = useCallback(async () => {
    setLoadingDecks(true);
    setError(null);
    try {
      const res = await fetch("/api/decks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load decks.");
      setDecks(data.decks ?? []);
      setSyncedAt(data.syncedAt ?? null);
      if ((data.decks ?? []).length === 0) await syncNow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load decks.");
    } finally {
      setLoadingDecks(false);
    }
  }, [syncNow]);

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
      await syncNow();
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
    setSyncedAt(null);
  };

  const handlePick = (deck: DeckSummary) => {
    if (pickingId) return;
    setPickingId(deck.id); // brief spinner while the deck page route loads
    onPick(deck);
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
            <TextInput
              htmlName="username"
              isLabelHidden
              label="Archidekt username or email"
              onChange={setIdentifier}
              placeholder="Archidekt username or email"
              value={identifier}
            />
            <TextInput
              htmlName="password"
              isLabelHidden
              label="Password"
              onChange={setPassword}
              placeholder="Password"
              type="password"
              value={password}
            />
            <Button
              isDisabled={!identifier || !password}
              isLoading={connecting}
              label={connecting ? "Connecting…" : "Connect"}
              type="submit"
              variant="primary"
            />
            <Button label="Cancel" onClick={() => setShowForm(false)} size="sm" variant="ghost" />
            {error ? (
              <div className="text-center">
                <Text color="inherit" size="xsm">
                  <span className="text-destructive">{error}</span>
                </Text>
              </div>
            ) : null}
          </form>
        ) : (
          <Button
            icon={<span aria-hidden>🔗</span>}
            label="Connect Archidekt to load your decks"
            onClick={() => setShowForm(true)}
          />
        )}
      </div>
    );
  }

  // --- Connected: pick a deck (cover-art gallery) ---
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
        <span>
          Your decks · <span className="text-foreground">{username}</span>
        </span>
        <span aria-hidden>·</span>
        <span>{syncedLabel(syncedAt)}</span>
        <Button
          isDisabled={syncing}
          label={syncing ? "syncing…" : "sync"}
          onClick={syncNow}
          size="sm"
          variant="ghost"
        />
        <Button label="disconnect" onClick={handleDisconnect} size="sm" variant="ghost" />
      </div>

      {loadingDecks ? (
        <div className="grid max-h-[19rem] w-full grid-cols-2 gap-3 p-0.5 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div className="aspect-[16/11]" key={i}>
              <Skeleton height="100%" radius={3} width="100%" />
            </div>
          ))}
        </div>
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
                <span className="absolute inset-0 grid place-items-center bg-black/40">
                  <Spinner aria-label="Opening deck" shade="onMedia" size="sm" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
