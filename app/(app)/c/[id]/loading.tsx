import { Skeleton } from "@astryxdesign/core/Skeleton";

// Chat skeleton: alternating user/assistant message shapes with a composer
// bar pinned at the bottom, so opening a chat renders structure instantly.
export default function ChatLoading() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 overflow-hidden px-4 py-8 sm:px-6">
      <div className="flex justify-end">
        <Skeleton height={40} radius={3} width="55%" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton height={14} width="85%" />
        <Skeleton height={14} width="70%" />
        <Skeleton height={14} width="78%" />
      </div>
      <div className="flex justify-end">
        <Skeleton height={40} radius={3} width="40%" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton height={14} width="80%" />
        <Skeleton height={14} width="60%" />
      </div>
      <div className="mt-auto">
        <Skeleton height={56} radius={3} width="100%" />
      </div>
    </div>
  );
}
