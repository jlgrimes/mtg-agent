import { Skeleton } from "@astryxdesign/core/Skeleton";

// Deck page skeleton: header (dots + title + meta + button) over the
// conversations list, mirroring DeckHome's layout so content pops in place.
export default function DeckLoading() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 overflow-hidden px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3">
        <Skeleton height={28} width="45%" />
        <Skeleton height={14} width="60%" />
        <Skeleton height={36} radius={2} width={130} />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton height={12} width={110} />
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {[0, 1, 2, 3].map((i) => (
            <div className="flex flex-col gap-1.5 px-3 py-2.5" key={i}>
              <Skeleton height={13} width="55%" />
              <Skeleton height={10} width={70} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
