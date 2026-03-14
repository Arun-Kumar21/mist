"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { tracksApi } from "@/lib/api";
import type { Track } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlayerPage() {
  const params = useParams<{ id: string }>();
  const trackId = Number(params?.id);

  const [track, setTrack] = useState<Track | null>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!trackId) return;

      try {
        const [trackRes, streamRes] = await Promise.all([tracksApi.getTrack(trackId), tracksApi.getStreamInfo(trackId)]);
        setTrack(trackRes.data.track);
        setStreamUrl(streamRes.data.streamUrl);
      } catch {
        setError("Unable to load this track. You may need to login first.");
      }
    };

    void load();
  }, [trackId]);

  if (error) {
    return <p className="text-red-300">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-semibold">Player</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{track?.title || "Loading..."}</CardTitle>
          <p className="text-lg text-muted-foreground">{track?.artist_name || ""}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {track?.genre_top ? <Badge>{track.genre_top}</Badge> : null}
          {streamUrl ? (
            <audio controls className="w-full" src={streamUrl}>
              Your browser does not support audio playback.
            </audio>
          ) : (
            <p className="text-muted-foreground">Preparing stream...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
