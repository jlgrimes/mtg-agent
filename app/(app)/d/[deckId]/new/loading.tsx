import { Skeleton } from "@astryxdesign/core/Skeleton";

// New-deck-chat skeleton: centered hero + composer shape while the deck
// snapshot loads server-side.
export default function NewDeckChatLoading() {
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 pb-[8vh] sm:px-6">
      <div className="flex w-full flex-col items-center gap-2">
        <Skeleton height={40} width="55%" />
        <Skeleton height={14} width="40%" />
      </div>
      <div className="w-full max-w-xl">
        <Skeleton height={88} radius={3} width="100%" />
      </div>
    </div>
  );
}
