'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/pessoal/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/pessoal/saude', label: 'Saúde Financeira', icon: '💚' },
  { href: '/pessoal/transacoes', label: 'Transações', icon: '💳' },
  { href: '/pessoal/importacoes', label: 'Importações', icon: '🗂️' },
  { href: '/pessoal/investimentos', label: 'Investimentos', icon: '📈' },
  { href: '/pessoal/orcamento', label: 'Orçamento', icon: '📊' },
  { href: '/pessoal/parcelas', label: 'Parcelas CC', icon: '📦' },
  { href: '/pessoal/metas', label: 'Metas', icon: '🎯' },
  { href: '/pessoal/projetos', label: 'Projetos', icon: '📁' },
  { href: '/pessoal/entidades', label: 'Entidades', icon: '🏷️' },
  { href: '/pessoal/relatorio', label: 'Exportar', icon: '📥' },
  { href: '/pessoal/perguntar', label: 'Conselheira IA', icon: '🤖' },
  { href: '/pessoal/configuracoes', label: 'Configurações', icon: '⚙️' },
  { href: '/pessoal/assinatura', label: 'Meu Plano', icon: '⭐' },
]

// Bottom tabs for mobile (5 most used)
const BOTTOM_TABS = [
  { href: '/pessoal/dashboard', label: 'Início', icon: '🏠' },
  { href: '/pessoal/saude', label: 'Saúde', icon: '💚' },
  { href: '/pessoal/transacoes', label: 'Transações', icon: '💳' },
  { href: '/pessoal/importacoes', label: 'Importar', icon: '🗂️' },
]

export default function PessoalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [usuario, setUsuario] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)

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

  useEffect(() => {
    if (pathname === '/pessoal') router.replace('/pessoal/dashboard')
  }, [pathname, router])

  if (!usuario) return null

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r">
        <div className="p-4 border-b">
          <div className="font-bold text-gray-900 text-sm">👤 Modo Pessoal</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">{usuario.nome}</div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                pathname === item.href
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t space-y-1">
          {usuario.temEmpresa && (
            <Link
              href="/empresa/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              <span>🏢</span> Modo Empresa
            </Link>
          )}
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

      {/* Mobile top header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b px-4 py-3 flex items-center justify-between safe-area-top">
        <span className="font-bold text-gray-900 text-base">
          {NAV.find((n) => n.href === pathname)?.icon || '👤'}{' '}
          {NAV.find((n) => n.href === pathname)?.label || 'Pessoal'}
        </span>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 text-xl"
          aria-label="Menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile full menu overlay */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/50"
          onClick={() => setMenuOpen(false)}
        >
          <aside
            className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b bg-green-600 text-white">
              <div className="font-bold">👤 Modo Pessoal</div>
              <div className="text-sm text-green-100 mt-0.5 truncate">{usuario.nome}</div>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                    pathname === item.href
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-600 active:bg-gray-100'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="p-3 border-t space-y-1">
              {usuario.temEmpresa && (
                <Link
                  href="/empresa/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-600"
                >
                  <span className="text-lg">🏢</span> Modo Empresa
                </Link>
              )}
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

      {/* Content area */}
      <main className="flex-1 md:overflow-auto pt-14 pb-20 md:pt-0 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t safe-area-bottom flex items-stretch">
        {BOTTOM_TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-center transition-colors ${
                active ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              <span className="text-2xl leading-none">{tab.icon}</span>
              <span className={`text-[10px] font-medium leading-tight ${active ? 'text-green-600' : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
        {/* More button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            menuOpen ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          <span className="text-2xl leading-none">☰</span>
          <span className="text-[10px] font-medium leading-tight">Mais</span>
        </button>
      </nav>
    </div>
  )
}
