"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "../../stores/auth";
import api from "../../lib/api";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const register = useAuthStore((s) => s.register);

  const inviteFromUrl = searchParams.get("invite") || "";
  const [inviteCode, setInviteCode] = useState(inviteFromUrl);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasUrlInvite = !!inviteFromUrl;

  // Validate invite code on blur or when loaded from URL
  useEffect(() => {
    if (!inviteCode || inviteCode.length < 10) {
      setInviteValid(null);
      setInviteError("");
      return;
    }
    const timer = setTimeout(async () => {
      try {
        await api.get(`/api/v1/invites/validate/${inviteCode}`);
        setInviteValid(true);
        setInviteError("");
      } catch (err: unknown) {
        setInviteValid(false);
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          "Invalid invite code";
        setInviteError(msg);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inviteCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!inviteCode) {
      setError("Invite code is required");
      return;
    }
    setLoading(true);
    try {
      await register(email, username, password, inviteCode);
      router.push("/play");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full">
        <div className="flex justify-center mb-4">
          <Image src="/logo.png" alt="EyeOnChess" width={80} height={80} priority />
        </div>
        <h1 className="text-2xl font-bold mb-6 text-center">Register</h1>
        <p className="text-sm text-gray-400 text-center mb-4">
          EyeOnChess is invite-only. You need an invite code to register.
        </p>
        {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invite code */}
          <div>
            <label className="block text-sm font-medium mb-1">Invite Code</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              readOnly={hasUrlInvite}
              required
              placeholder="Paste your invite code"
              className={`w-full px-3 py-2 bg-gray-800 border rounded font-mono text-sm focus:outline-none ${
                hasUrlInvite
                  ? "border-gray-600 text-gray-400 cursor-not-allowed"
                  : "border-gray-700 focus:border-blue-500"
              } ${inviteValid === true ? "border-green-600" : inviteValid === false ? "border-red-600" : ""}`}
            />
            {inviteValid === true && (
              <p className="text-xs text-green-400 mt-1">Valid invite code</p>
            )}
            {inviteError && <p className="text-xs text-red-400 mt-1">{inviteError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
          </div>
          <button
            type="submit"
            disabled={loading || inviteValid === false}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-medium transition-colors"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>
        <p className="text-sm text-gray-400 mt-4 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
