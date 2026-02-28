import { Link, useLocation, useNavigate } from 'react-router'
import { NavRoutes } from './routes'
import { useAuthStore } from '../../store/authStore'
import { cn } from '@/lib/utils'

export default function Nav() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="sticky top-0 z-50 w-full h-14 flex items-center justify-between border-b border-neutral-200/70 px-6 backdrop-blur-md bg-white/80">
      <Link to="/" className="text-sm font-bold tracking-widest uppercase">
        MIST
      </Link>

      <div className="flex items-center gap-0.5">
        {NavRoutes.map((route) => (
          <Link
            to={route.href}
            key={route.href}
            className={cn(
              'px-3 py-1.5 text-sm rounded-full transition-colors',
              pathname === route.href
                ? 'bg-black/[0.06] text-black font-medium'
                : 'text-neutral-500 hover:text-black hover:bg-black/[0.04]'
            )}
          >
            {route.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <span className="text-xs font-medium bg-neutral-100 text-neutral-600 rounded-full px-3 py-1.5 border border-neutral-200">
              {user.username}
            </span>
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="text-sm px-3 py-1.5 rounded-full border border-neutral-200 hover:border-neutral-400 hover:text-black transition-colors text-neutral-500"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="text-sm px-4 py-1.5 rounded-full bg-black text-white hover:bg-neutral-800 transition-colors"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  )
}
