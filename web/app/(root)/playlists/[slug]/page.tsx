type PlaylistDetailPageProps = {
  params: Promise<{ slug: string }>
}

export default async function PlaylistDetailPage({ params }: PlaylistDetailPageProps) {
  const { slug } = await params

  return (
    <section className="p-4">
      <h1 className="text-2xl font-semibold">Playlist: {slug}</h1>
    </section>
  )
}
