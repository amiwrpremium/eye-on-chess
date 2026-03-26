"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "../../../components/Toast";
import ConfirmModal from "../../../components/ConfirmModal";
import { adminRequest } from "../../../lib/adminApi";

interface Bot {
  id: string;
  botId: string;
  name: string;
  elo: number;
  description: string;
  avatar: string;
  tier: string;
  category: string;
  enabled: boolean;
  sortOrder: number;
  randomMoveChance: number;
  blunderChance: number;
  captureGreed: number;
  aggressionBias: number;
  maxDepth: number;
  queenEarly: boolean;
  pawnPusher: boolean;
  messages: Record<string, string[]> | null;
  preferredOpenings: { asWhite?: string[]; asBlack?: string[] } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TIERS = ["custom", "hybrid", "engine"];
const CATEGORIES = [
  "beginner",
  "novice",
  "intermediate",
  "advanced",
  "expert",
  "master",
  "grandmaster",
];

function defaultBot(): Partial<Bot> {
  return {
    botId: "",
    name: "",
    elo: 800,
    description: "",
    avatar: "",
    tier: "custom",
    category: "novice",
    enabled: true,
    randomMoveChance: 0.1,
    blunderChance: 0.1,
    captureGreed: 0.3,
    aggressionBias: 0,
    maxDepth: 2,
    queenEarly: false,
    pawnPusher: false,
  };
}

export default function AdminBotsPage() {
  const toast = useToast();
  const [bots, setBots] = useState<Bot[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [editBot, setEditBot] = useState<Bot | null>(null);
  const [createBot, setCreateBot] = useState<Partial<Bot> | null>(null);
  const [confirm, setConfirm] = useState<{
    type: "delete" | "toggle" | "reseed";
    bot?: Bot;
  } | null>(null);

  // Edit form state
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [messagesJson, setMessagesJson] = useState("");
  const [openingsJson, setOpeningsJson] = useState("");

  const loadBots = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const data = await adminRequest("get", `/api/v1/admin/bots?${params}`);
      setBots(data.bots);
      setPagination(data.pagination);
    } catch {
      toast.show("Failed to load bots", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  function openEdit(bot: Bot) {
    setEditBot(bot);
    setForm({ ...bot });
    setMessagesJson(bot.messages ? JSON.stringify(bot.messages, null, 2) : "");
    setOpeningsJson(bot.preferredOpenings ? JSON.stringify(bot.preferredOpenings, null, 2) : "");
  }

  function openCreate() {
    const d = defaultBot();
    setCreateBot(d);
    setForm({ ...d });
    setMessagesJson("");
    setOpeningsJson("");
  }

  async function saveBot() {
    setActionLoading(true);
    try {
      const data: Record<string, unknown> = { ...form };
      if (messagesJson.trim()) {
        data.messages = JSON.parse(messagesJson);
      }
      if (openingsJson.trim()) {
        data.preferredOpenings = JSON.parse(openingsJson);
      }

      if (editBot) {
        // Remove fields that shouldn't be sent in PATCH
        delete data.id;
        delete data.botId;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.messages;
        delete data.preferredOpenings;
        // Re-add parsed JSON fields
        if (messagesJson.trim()) data.messages = JSON.parse(messagesJson);
        if (openingsJson.trim()) data.preferredOpenings = JSON.parse(openingsJson);

        await adminRequest("patch", `/api/v1/admin/bots/${editBot.id}`, data);
        toast.show("Bot updated");
      } else {
        await adminRequest("post", "/api/v1/admin/bots", data);
        toast.show("Bot created");
      }
      setEditBot(null);
      setCreateBot(null);
      await loadBots();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Save failed";
      toast.show(msg, "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteBot(id: string) {
    setActionLoading(true);
    try {
      await adminRequest("delete", `/api/v1/admin/bots/${id}`);
      toast.show("Bot deleted");
      await loadBots();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Delete failed";
      toast.show(msg, "error");
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  }

  async function toggleEnabled(bot: Bot) {
    setActionLoading(true);
    try {
      await adminRequest("patch", `/api/v1/admin/bots/${bot.id}`, { enabled: !bot.enabled });
      toast.show(bot.enabled ? "Bot disabled" : "Bot enabled");
      await loadBots();
    } catch {
      toast.show("Toggle failed", "error");
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  }

  async function reseed() {
    setActionLoading(true);
    try {
      const data = await adminRequest("post", "/api/v1/admin/bots/reseed");
      toast.show(`Reseed complete: ${data.created} created, ${data.updated} updated`);
      await loadBots();
    } catch {
      toast.show("Reseed failed", "error");
    } finally {
      setActionLoading(false);
      setConfirm(null);
    }
  }

  const isEditing = !!editBot || !!createBot;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bot Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirm({ type: "reseed" })}
            className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium"
          >
            Reseed from YAML
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
          >
            + Create Bot
          </button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, ID, or category..."
        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded mb-4 text-sm"
      />

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : bots.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No bots found.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-left">
                  <th className="py-2 px-3">Bot</th>
                  <th className="py-2 px-3">Elo</th>
                  <th className="py-2 px-3">Tier</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => (
                  <tr key={bot.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-2 px-3">
                      <span className="mr-2">{bot.avatar}</span>
                      <span className="font-medium">{bot.name}</span>
                      <span className="text-gray-500 ml-1 text-xs">({bot.botId})</span>
                    </td>
                    <td className="py-2 px-3">{bot.elo}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{bot.tier}</span>
                    </td>
                    <td className="py-2 px-3 capitalize">{bot.category}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${bot.enabled ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}
                      >
                        {bot.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(bot)}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirm({ type: "toggle", bot })}
                          className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs"
                        >
                          {bot.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => setConfirm({ type: "delete", bot })}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {bots.map((bot) => (
              <div key={bot.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="mr-2 text-xl">{bot.avatar}</span>
                    <span className="font-medium">{bot.name}</span>
                    <span className="text-gray-500 ml-1 text-xs">({bot.elo})</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${bot.enabled ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}
                  >
                    {bot.enabled ? "On" : "Off"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{bot.description}</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(bot)}
                    className="flex-1 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirm({ type: "toggle", bot })}
                    className="flex-1 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs"
                  >
                    {bot.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => setConfirm({ type: "delete", bot })}
                    className="flex-1 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
              >
                Prev
              </button>
              <span className="text-sm text-gray-400">
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit/Create Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-10 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-2xl mb-10">
            <h2 className="text-xl font-bold mb-4">
              {editBot ? `Edit ${editBot.name}` : "Create Bot"}
            </h2>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                {!editBot && (
                  <div>
                    <label className="text-xs text-gray-400">Bot ID (slug)</label>
                    <input
                      value={(form.botId as string) || ""}
                      onChange={(e) => setForm({ ...form, botId: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                      placeholder="my_bot"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-400">Name</label>
                  <input
                    value={(form.name as string) || ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Avatar (emoji)</label>
                  <input
                    value={(form.avatar as string) || ""}
                    onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Elo ({String(form.elo ?? "")})</label>
                  <input
                    type="range"
                    min={100}
                    max={3200}
                    step={50}
                    value={(form.elo as number) || 800}
                    onChange={(e) => setForm({ ...form, elo: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Tier</label>
                  <select
                    value={(form.tier as string) || "custom"}
                    onChange={(e) => setForm({ ...form, tier: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Category</label>
                  <select
                    value={(form.category as string) || "novice"}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400">Description</label>
                <input
                  value={(form.description as string) || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                />
              </div>

              {/* Behavior Sliders */}
              <div className="border-t border-gray-700 pt-3">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Behavior</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "randomMoveChance", label: "Random Move %", min: 0, max: 1, step: 0.01 },
                    { key: "blunderChance", label: "Blunder %", min: 0, max: 1, step: 0.01 },
                    { key: "captureGreed", label: "Capture Greed", min: 0, max: 1, step: 0.01 },
                    { key: "aggressionBias", label: "Aggression", min: -1, max: 1, step: 0.01 },
                  ].map(({ key, label, min, max, step }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-400">
                        {label} ({((form[key] as number) || 0).toFixed(2)})
                      </label>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={(form[key] as number) || 0}
                        onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-400">
                      Max Depth ({String(form.maxDepth ?? "")})
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={18}
                      value={(form.maxDepth as number) || 3}
                      onChange={(e) => setForm({ ...form, maxDepth: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form.queenEarly as boolean) || false}
                      onChange={() => setForm({ ...form, queenEarly: !form.queenEarly })}
                    />
                    Queen Early
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form.pawnPusher as boolean) || false}
                      onChange={() => setForm({ ...form, pawnPusher: !form.pawnPusher })}
                    />
                    Pawn Pusher
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form.enabled as boolean) ?? true}
                      onChange={() => setForm({ ...form, enabled: !form.enabled })}
                    />
                    Enabled
                  </label>
                </div>
              </div>

              {/* Messages JSON */}
              <div className="border-t border-gray-700 pt-3">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Messages (JSON)</h3>
                <textarea
                  value={messagesJson}
                  onChange={(e) => setMessagesJson(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs font-mono"
                  placeholder='{"gameStart": ["Hello!"], "onCapture": ["Got one!"]}'
                />
              </div>

              {/* Openings JSON */}
              <div className="border-t border-gray-700 pt-3">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">
                  Preferred Openings (JSON)
                </h3>
                <textarea
                  value={openingsJson}
                  onChange={(e) => setOpeningsJson(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs font-mono"
                  placeholder='{"asWhite": ["e4 e5 Nf3"], "asBlack": ["e5"]}'
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-700">
              <button
                onClick={saveBot}
                disabled={actionLoading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-medium text-sm"
              >
                {actionLoading ? "Saving..." : editBot ? "Save Changes" : "Create Bot"}
              </button>
              <button
                onClick={() => {
                  setEditBot(null);
                  setCreateBot(null);
                }}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modals */}
      <ConfirmModal
        open={confirm?.type === "delete"}
        title={`Delete ${confirm?.bot?.name}?`}
        message="This will permanently remove this bot. Players will no longer be able to play against it."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => confirm?.bot && deleteBot(confirm.bot.id)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.type === "toggle"}
        title={`${confirm?.bot?.enabled ? "Disable" : "Enable"} ${confirm?.bot?.name}?`}
        message={
          confirm?.bot?.enabled
            ? "Disabled bots won't appear in the bot selector."
            : "This bot will appear in the bot selector."
        }
        confirmLabel={confirm?.bot?.enabled ? "Disable" : "Enable"}
        confirmVariant="primary"
        onConfirm={() => confirm?.bot && toggleEnabled(confirm.bot)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.type === "reseed"}
        title="Reseed from YAML?"
        message="This will overwrite ALL bot personalities with values from bots.yml. Any admin edits will be lost."
        confirmLabel="Reseed"
        confirmVariant="danger"
        onConfirm={reseed}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
