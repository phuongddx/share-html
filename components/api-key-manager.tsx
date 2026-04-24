"use client";

/**
 * API Key Manager — client component for the user dashboard.
 * Lists existing API keys, generates new ones, and revokes keys.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Copy, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

interface NewKeyResponse {
  key: string;
  prefix: string;
  name: string;
  created_at: string;
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResponse | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/keys");
      if (!res.ok) throw new Error("Failed to fetch keys");
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleGenerate() {
    const trimmed = keyName.trim();
    if (!trimmed) {
      toast.error("Please enter a name for the key");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate key");
      }
      const data: NewKeyResponse = await res.json();
      setNewKey(data);
      setKeyName("");
      // Refresh list (new key won't show the full key, only prefix)
      await fetchKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate key");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke key "${name}"? This cannot be undone.`)) return;

    setRevokingId(id);
    try {
      const res = await fetch(`/api/v1/keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke key");
      toast.success(`Key "${name}" revoked`);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      toast.error("Failed to revoke key");
    } finally {
      setRevokingId(null);
    }
  }

  function handleCopyKey(key: string) {
    navigator.clipboard.writeText(key).then(
      () => toast.success("API key copied to clipboard"),
      () => toast.error("Failed to copy key"),
    );
  }

  function closeDialog() {
    setShowDialog(false);
    setNewKey(null);
    setKeyName("");
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "Never";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="size-5" />
            API Keys
          </CardTitle>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="size-4" />
            Generate Key
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" />
            Loading keys...
          </div>
        ) : keys.length === 0 && !showDialog ? (
          <p className="text-sm text-muted-foreground py-4">
            No API keys yet. Generate one to access the REST API.
          </p>
        ) : (
          <div className="divide-y">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{k.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {k.key_prefix}...
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Created {formatDate(k.created_at)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Last used {formatDate(k.last_used_at)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="icon-xs"
                  onClick={() => handleRevoke(k.id, k.name)}
                  disabled={revokingId === k.id}
                  aria-label={`Revoke key ${k.name}`}
                >
                  {revokingId === k.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Trash2 className="size-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Dialog overlay */}
        {showDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  {newKey ? "Your New API Key" : "Generate API Key"}
                </h3>
                <Button variant="ghost" size="icon-xs" onClick={closeDialog}>
                  <X className="size-4" />
                </Button>
              </div>

              {newKey ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                    Copy this key now. It won&apos;t be shown again.
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                      {newKey.key}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyKey(newKey.key)}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Name: <strong>{newKey.name}</strong>
                  </p>
                  <Button className="w-full" onClick={closeDialog}>
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="key-name" className="text-sm font-medium">
                      Key Name
                    </label>
                    <Input
                      id="key-name"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder='e.g. "CI/CD", "My Laptop"'
                      maxLength={100}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleGenerate();
                      }}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button onClick={handleGenerate} disabled={generating}>
                      {generating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Generate"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
