'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Stats = {
  totalUsuarios: number
  usuariosAtivos: number
  usuariosSuspensos: number
  novosEstaMes: number
  novosSemana: number
  totalEmpresa: number
  totalPessoal: number
  planos: Array<{ plano: string; count: number }>
}

function KPI({ label, value, sub, cor }: { label: string; value: string | number; sub?: string; cor?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border shadow-sm">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-bold ${cor || 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (!parsed.isAdmin) { router.push('/login'); return }
    setToken(t)
    fetch('/api/v2/admin/stats', { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false))
  }, [router])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
        <p className="text-gray-500 mt-1">Visão geral da plataforma Radar Financeiro</p>
      </div>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPI label="Total de usuários" value={stats.totalUsuarios} />
            <KPI label="Ativos" value={stats.usuariosAtivos} cor="text-green-600" />
            <KPI label="Suspensos" value={stats.usuariosSuspensos} cor={stats.usuariosSuspensos > 0 ? 'text-red-500' : 'text-gray-900'} />
            <KPI label="Novos esta semana" value={stats.novosSemana} cor="text-blue-600" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <KPI label="Novos este mês" value={stats.novosEstaMes} />
            <KPI label="Contas Empresa" value={stats.totalEmpresa} sub="usuários com modo empresa" />
            <KPI label="Contas Pessoal" value={stats.totalPessoal} sub="usuários com modo pessoal" />
          </div>

          {stats.planos.length > 0 && (
            <div className="bg-white rounded-xl p-6 border shadow-sm mb-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Distribuição por plano</h2>
              <div className="flex gap-6">
                {stats.planos.map((p) => (
                  <div key={p.plano} className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{p.count}</div>
                    <div className="text-xs text-gray-500 capitalize mt-1">{p.plano}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Link
              href="/admin/usuarios"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Ver todos os usuários →
            </Link>
          </div>
        </>
      ) : (
        <div className="text-red-500">Erro ao carregar dados.</div>
      )}
    </div>
  )
}
