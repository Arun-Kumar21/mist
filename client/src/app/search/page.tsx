"use client";

import Link from "next/link";
import { useState } from "react";

import { tracksApi } from "@/lib/api";
import type { Track } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setTracks([]);
      return;
    }

    setLoading(true);
    try {
      const res = await tracksApi.searchTrack(query);
      setTracks(res.data.tracks || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-semibold">Search</h1>

      <form onSubmit={onSearch} className="flex gap-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or artist" />
        <Button type="submit">Find</Button>
      </form>

      {loading ? <p className="text-muted-foreground">Searching...</p> : null}

      <div className="grid gap-4">
        {tracks.map((track) => (
          <Link key={track.track_id} href={`/player/${track.track_id}`}>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{track.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">{track.artist_name}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
