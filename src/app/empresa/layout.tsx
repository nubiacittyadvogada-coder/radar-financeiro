'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/empresa/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/empresa/importar', label: 'Importar', icon: '📂' },
  { href: '/empresa/importacoes', label: 'Importações', icon: '🗂️' },
  { href: '/empresa/contas', label: 'Contas a Pagar', icon: '💸' },
  { href: '/empresa/historico', label: 'Histórico', icon: '📅' },
  { href: '/empresa/cobranca', label: 'Cobranças', icon: '🔔' },
  { href: '/empresa/relatorio', label: 'Relatório', icon: '📄' },
  { href: '/empresa/perguntar', label: 'Perguntar IA', icon: '🤖' },
]

export default function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [usuario, setUsuario] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setUsuario(parsed)
  }, [router])

  function sair() {
    localStorage.removeItem('radar_token')
    localStorage.removeItem('radar_usuario')
    document.cookie = 'radar_sessao=; path=/; max-age=0'
    router.push('/login')
  }

  if (!usuario) return null

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r">
        <div className="p-4 border-b">
          <div className="font-bold text-gray-900 text-sm">🏢 Modo Empresa</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">{usuario.nome}</div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                pathname === item.href
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t space-y-1">
          {usuario.temPessoal && (
            <Link
              href="/pessoal/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              <span>👤</span> Modo Pessoal
            </Link>
          )}
          <Link
            href="/empresa/configuracoes"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            <span>⚙️</span> Configurações
          </Link>
          <Link
            href="/conta"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            <span>🔑</span> Alterar senha
          </Link>
          <button
            onClick={sair}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 text-left"
          >
            <span>🚪</span> Sair
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-gray-900">🏢 Empresa</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-600">
          {sidebarOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/40" onClick={() => setSidebarOpen(false)}>
          <aside className="absolute right-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b bg-blue-600 text-white">
              <div className="font-bold">🏢 Modo Empresa</div>
              <div className="text-sm text-blue-100 mt-0.5 truncate">{usuario.nome}</div>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                    pathname === item.href ? 'bg-blue-50 text-blue-700' : 'text-gray-600 active:bg-gray-100'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="p-3 border-t space-y-1">
              {usuario.temPessoal && (
                <Link
                  href="/pessoal/dashboard"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-700 font-semibold bg-green-50 active:bg-green-100"
                >
                  <span className="text-lg">👤</span> Modo Pessoal
                </Link>
              )}
              <Link
                href="/conta"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-600"
              >
                <span className="text-lg">🔑</span> Alterar senha
              </Link>
              <button
                onClick={sair}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-red-600 text-left"
              >
                <span className="text-lg">🚪</span> Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
