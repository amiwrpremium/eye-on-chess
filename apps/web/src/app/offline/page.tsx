"use client";

import Link from "next/link";
import Image from "next/image";

export default function OfflinePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <Image src="/logo.png" alt="EyeOnChess" width={80} height={80} className="mb-6 opacity-50" />
      <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
      <p className="text-gray-400 mb-6 max-w-sm">
        No internet connection. You can still play against the bot offline — your games will sync
        when you reconnect.
      </p>
      <div className="flex flex-col gap-3">
        <Link
          href="/play/bot"
          className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded font-medium transition-colors"
        >
          Play vs Bot (Offline)
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
