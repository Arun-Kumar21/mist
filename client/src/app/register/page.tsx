"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await authApi.register(username, password);
      const token = res.data.token;

      setAuth(
        {
          id: res.data.user_id || "",
          username: res.data.username || username,
          role: (res.data.role as "user" | "admin") || "user",
        },
        token
      );

      router.push("/library");
    } catch {
      setError("Unable to create account. Check username/password rules.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription className="text-base">Start listening in a few seconds.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 characters)"
              type="password"
              required
            />
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
