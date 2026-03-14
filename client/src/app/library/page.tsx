"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { tracksApi } from "@/lib/api";
import type { Track } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LibraryPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await tracksApi.getTracks({ limit: 24 });
        setTracks(res.data.tracks || []);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold">Library</h1>
        <p className="mt-2 text-lg text-muted-foreground">Browse all processed tracks.</p>
      </div>

      {loading ? <p className="text-muted-foreground">Loading tracks...</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {tracks.map((track) => (
          <Link href={`/player/${track.track_id}`} key={track.track_id}>
            <Card className="h-full transition-transform hover:-translate-y-0.5">
              <CardHeader>
                <CardTitle className="text-2xl">{track.title || "Untitled"}</CardTitle>
                <CardDescription className="text-base">{track.artist_name || "Unknown Artist"}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Badge>{track.genre_top || "Unknown genre"}</Badge>
                <span className="text-sm text-muted-foreground">{Math.round((track.duration_sec || 0) / 60)} min</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
