import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="space-y-10 lg:space-y-14">
      <section className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
        <div className="space-y-6">
          <Badge className="rounded-md border border-border/80 bg-secondary/60 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Premium streaming platform
          </Badge>
          <h1 className="max-w-4xl text-hero font-display">A private audio platform built for modern listening teams.</h1>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            MIST delivers secure playback, encrypted HLS delivery, and fast discovery in a focused interface designed
            for production use.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/library">Enter library</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/search">Find tracks</Link>
            </Button>
          </div>
        </div>

        <Card className="relative overflow-hidden border-border/90 bg-card/80">
          <CardHeader>
            <CardDescription className="text-sm uppercase tracking-[0.14em]">Operational status</CardDescription>
            <CardTitle className="text-4xl">All systems active</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <p>Upload, processing, and streaming services are integrated in one dark-first workspace.</p>
            <Button variant="outline" asChild>
              <Link href="/admin/upload">Upload a track</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Encryption</CardDescription>
            <CardTitle className="text-3xl">AES-128</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Secure segment playback with authenticated key delivery.</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Pipeline</CardDescription>
            <CardTitle className="text-3xl">Async jobs</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Direct uploads and Celery processing keep the API responsive.</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Discovery</CardDescription>
            <CardTitle className="text-3xl">Smart search</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Query by artist or title and jump into player views instantly.</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Scale</CardDescription>
            <CardTitle className="text-3xl">Cloud-native</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Compose-ready services tuned for reliable local and hosted deployments.</CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Upload pipeline</CardTitle>
            <CardDescription>Direct upload to S3 with predictable processing stages.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">Create upload requests, monitor status, and publish playable tracks quickly.</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Streaming flow</CardTitle>
            <CardDescription>Encrypted HLS playback routed through authenticated API endpoints.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">Protect content while preserving smooth browser playback performance.</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Library management</CardTitle>
            <CardDescription>Admin controls for track curation and metadata updates.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">Organize catalog quality with one focused management surface.</CardContent>
        </Card>
      </section>

      <section className="rounded-lg border border-border/80 bg-secondary/35 p-6 sm:p-8">
        <h2 className="text-3xl font-semibold">Ready to ship your audio workspace</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Build encrypted media pipelines, manage catalogs, and deliver playback from one clean interface.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/library">Browse catalog</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/tracks">Open admin</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
