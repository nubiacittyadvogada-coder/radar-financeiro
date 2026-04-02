'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/usuarios', label: 'Usuários', icon: '👥' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [usuario, setUsuario] = useState<any>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (!parsed.isAdmin) { router.push('/login'); return }
    setUsuario(parsed)
  }, [router])

  function sair() {
    localStorage.removeItem('radar_token')
    localStorage.removeItem('radar_usuario')
    router.push('/login')
  }

  if (!usuario) return null

  return (
    <div className="min-h-screen flex bg-gray-950">
      <aside className="w-56 bg-gray-900 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="font-bold text-white text-sm">⚡ Admin</div>
          <div className="text-xs text-gray-400 mt-0.5 truncate">{usuario.email}</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                pathname === item.href
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={sair}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white text-left"
          >
            <span>🚪</span> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
