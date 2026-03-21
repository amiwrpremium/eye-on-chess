"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse bg-gray-700 rounded ${className}`} />;
}

export function BoardSkeleton() {
  return (
    <div className="w-full aspect-square bg-gray-800 rounded animate-pulse flex items-center justify-center">
      <span className="text-gray-600 text-sm">Loading board...</span>
    </div>
  );
}

export function MoveListSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg p-3 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="w-6 h-5" />
          <Skeleton className="w-16 h-5" />
          <Skeleton className="w-16 h-5" />
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full">
      <div className="flex flex-col items-center">
        <Skeleton className="w-20 h-20 rounded-full mb-4" />
        <Skeleton className="w-32 h-6 mb-2" />
        <Skeleton className="w-24 h-4" />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Skeleton className="h-16 rounded" />
        <Skeleton className="h-16 rounded" />
      </div>
    </div>
  );
}
