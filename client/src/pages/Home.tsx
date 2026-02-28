import { useNavigate } from 'react-router'
import { useAuthStore } from '../store/authStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Music, Search, Library } from 'lucide-react'
import { getGradient } from '@/lib/gradient'

const features = [
  {
    icon: Music,
    title: 'HLS Streaming',
    description: 'Adaptive bitrate audio delivery with HTTP Live Streaming for seamless playback.',
  },
  {
    icon: Shield,
    title: 'Encrypted Keys',
    description: 'AES-128 encryption keys served exclusively to authenticated users.',
  },
  {
    icon: Library,
    title: 'Personal Library',
    description: 'Browse and play from a curated catalogue of tracks with listening history.',
  },
  {
    icon: Search,
    title: 'Track Search',
    description: 'Find any track instantly by title or artist name across the full catalogue.',
  },
]

export default function Home() {
  const { user, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="pt-16 pb-8 space-y-6">
        <p className="text-xs font-medium tracking-widest uppercase text-neutral-400">
          Music Streaming
        </p>
        <h1 className="text-5xl font-bold tracking-tight leading-none">MIST</h1>
        <p className="text-neutral-500 max-w-lg text-base leading-relaxed">
          A minimal, secure music streaming platform. Encrypted HLS delivery, role-based access, and a clean listening experience.
        </p>
        <div className="flex gap-3 pt-2">
          {isAuthenticated ? (
            <>
              <Button onClick={() => navigate('/library')}>Browse Library</Button>
              <Button variant="outline" onClick={() => navigate('/search')}>Search Tracks</Button>
            </>
          ) : (
            <>
              <Button onClick={() => navigate('/login')}>Get Started</Button>
              <Button variant="outline" onClick={() => navigate('/library')}>Browse Library</Button>
            </>
          )}
        </div>
        {isAuthenticated && user && (
          <p className="text-sm text-neutral-400">
            Signed in as <span className="text-black font-medium">{user.username}</span>
            {user.role === 'admin' && (
              <span className="ml-2 text-xs border border-black px-1.5 py-0.5 uppercase tracking-wide">admin</span>
            )}
          </p>
        )}
      </section>

      {/* Features */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium tracking-widest uppercase text-neutral-400">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardContent className="p-5 flex gap-4 items-start">
                <div
                  className="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: getGradient(title) }}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">{title}</p>
                  <p className="text-sm text-neutral-500 leading-relaxed">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Admin panel */}
      {isAuthenticated && user?.role === 'admin' && (
        <section className="space-y-4 border-t border-neutral-200 pt-8">
          <h2 className="text-xs font-medium tracking-widest uppercase text-neutral-400">Admin</h2>
          <div className="flex gap-3">
            <Button size="sm" onClick={() => navigate('/admin/upload')}>Upload Track</Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/tracks')}>Manage Tracks</Button>
          </div>
        </section>
      )}
    </div>
  )
}
