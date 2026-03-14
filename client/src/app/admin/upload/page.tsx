"use client";

import { useState } from "react";

import { uploadApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [status, setStatus] = useState("");

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus("Requesting upload URL...");

    try {
      const requestRes = await uploadApi.requestUpload({
        filename: file.name,
        filesize: file.size,
        contentType: file.type || "audio/mpeg",
        metadata: { title, artist },
      });

      const formData = new FormData();
      for (const [key, value] of Object.entries(requestRes.data.fields)) {
        formData.append(key, value);
      }
      formData.append("file", file);

      setStatus("Uploading file to storage...");
      await fetch(requestRes.data.uploadUrl, {
        method: "POST",
        body: formData,
      });

      setStatus("Notifying upload service...");
      await uploadApi.completeUpload({
        jobId: requestRes.data.jobId,
        metadata: { title, artist },
      });

      setStatus("Upload submitted. Processing started.");
    } catch {
      setStatus("Upload failed. Check auth or service logs.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Upload Track</CardTitle>
          <CardDescription className="text-base">Send a new audio file into the processing pipeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onUpload} className="space-y-4">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Track title" />
            <Input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist name" />
            <Input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
            <Button type="submit" className="w-full">
              Start upload
            </Button>
            {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
