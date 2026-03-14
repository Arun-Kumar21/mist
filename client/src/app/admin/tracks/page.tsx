"use client";

import { useEffect, useState } from "react";

import { tracksApi } from "@/lib/api";
import type { Track } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminTracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await tracksApi.getTracks({ limit: 50 });
      setTracks(res.data.tracks || []);
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-semibold">Manage Tracks</h1>
      <div className="grid gap-3">
        {tracks.map((track) => (
          <Card key={track.track_id}>
            <CardHeader>
              <CardTitle className="text-2xl">{track.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">{track.artist_name}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
