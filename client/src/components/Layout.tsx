import { Outlet } from 'react-router'
import Nav from './nav/index'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Nav />
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
