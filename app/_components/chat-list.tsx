"use client";

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: number;
}

// Conversation history. Fills its container — the parent places it as a static
// rail on desktop and a slide-in drawer on mobile.
export function ChatList({
  chats,
  currentChatId,
  loading,
  onNew,
  onOpen,
  onDelete,
  onClose,
}: {
  readonly chats: ChatSummary[];
  readonly currentChatId: string | null;
  readonly loading: boolean;
  readonly onNew: () => void;
  readonly onOpen: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onClose?: () => void;
}) {
  return (
    <aside className="flex h-full w-full flex-col bg-muted/20">
      <div className="flex items-center justify-between px-4 py-3.5">
        <span className="font-semibold text-sm">
          Commander <span className="font-normal text-muted-foreground">Copilot</span>
        </span>
        {onClose ? (
          <button
            aria-label="Close menu"
            className="rounded p-1 text-muted-foreground hover:text-foreground md:hidden"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        ) : null}
      </div>

      <div className="px-3 pb-1">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-medium text-sm transition-colors hover:bg-muted"
          onClick={onNew}
          type="button"
        >
          <span className="text-base leading-none">＋</span> New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <div className="px-2 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Recent
        </div>
        {loading ? (
          <p className="px-2 py-1 text-muted-foreground text-xs">Loading…</p>
        ) : chats.length === 0 ? (
          <p className="px-2 py-1 text-muted-foreground text-xs">No conversations yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {chats.map((chat) => (
              <li className="group relative" key={chat.id}>
                <button
                  className={`flex w-full items-center rounded-md px-2 py-2 pr-7 text-left text-sm transition-colors hover:bg-muted ${
                    chat.id === currentChatId ? "bg-muted font-medium" : "text-foreground/90"
                  }`}
                  onClick={() => onOpen(chat.id)}
                  type="button"
                >
                  <span className="min-w-0 flex-1 truncate">{chat.title || "Untitled"}</span>
                </button>
                <button
                  aria-label="Delete chat"
                  className="absolute top-1.5 right-1 rounded p-1 text-muted-foreground/50 transition-colors hover:bg-background hover:text-destructive"
                  onClick={() => onDelete(chat.id)}
                  type="button"
                >
                  <span className="text-xs">✕</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
