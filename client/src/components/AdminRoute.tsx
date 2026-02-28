import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '../store/authStore'

interface AdminRouteProps {
  children: React.ReactNode
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (user && user.role !== 'admin') {
      navigate('/')
    }
  }, [isAuthenticated, user, navigate])

  if (!isAuthenticated || !user || user.role !== 'admin') return null

  return <>{children}</>
}
