'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Assinatura = {
  id: string
  plano: string
  status: string
  valorMensal: string | number
  venceEm: string | null
  criadoEm: string
  usuario: {
    nome: string
    email: string
    plano: string
    planoValidoAte: string | null
  }
  pagamentos: Array<{
    id: string
    status: string
    valor: string | number
    vencimento: string
    pagoEm: string | null
  }>
}

const STATUS_CORES: Record<string, string> = {
  ativa: 'bg-green-100 text-green-700',
  pendente: 'bg-yellow-100 text-yellow-700',
  cancelada: 'bg-gray-100 text-gray-500',
  inadimplente: 'bg-red-100 text-red-700',
}

const PLANO_CORES: Record<string, string> = {
  basico: 'bg-gray-100 text-gray-600',
  pro: 'bg-blue-100 text-blue-700',
  premium: 'bg-green-100 text-green-700',
}

function fmt(v: string | number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function AdminAssinaturasPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([])
  const [mrr, setMrr] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (!parsed.isAdmin) { router.push('/login'); return }
    setToken(t)
    fetch('/api/v2/admin/assinaturas', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => {
        setAssinaturas(d.assinaturas || [])
        setMrr(d.mrr || 0)
      })
      .catch(() => setErro('Erro ao carregar assinaturas.'))
      .finally(() => setLoading(false))
  }, [router])

  const ativas = assinaturas.filter(a => a.status === 'ativa').length
  const pendentes = assinaturas.filter(a => a.status === 'pendente').length
  const inadimplentes = assinaturas.filter(a => a.status === 'inadimplente').length

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Admin</Link>
        <h1 className="text-2xl font-bold text-gray-900">Assinaturas e MRR</h1>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{erro}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">MRR</div>
          <div className="text-3xl font-bold text-green-600">{fmt(mrr)}</div>
          <div className="text-xs text-gray-400 mt-1">receita mensal recorrente</div>
        </div>
        <div className="bg-white rounded-xl p-5 border shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total assinaturas</div>
          <div className="text-3xl font-bold text-gray-900">{assinaturas.length}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Ativas</div>
          <div className="text-3xl font-bold text-green-600">{ativas}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Inadimplentes</div>
          <div className={`text-3xl font-bold ${inadimplentes > 0 ? 'text-red-500' : 'text-gray-900'}`}>{inadimplentes}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : assinaturas.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
          Nenhuma assinatura encontrada ainda.
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">Usuário</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">Plano</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">Valor</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">Vence em</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">Desde</th>
              </tr>
            </thead>
            <tbody>
              {assinaturas.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{a.usuario.nome}</div>
                    <div className="text-xs text-gray-400">{a.usuario.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${PLANO_CORES[a.plano] || PLANO_CORES.basico}`}>
                      {a.plano}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CORES[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {a.status === 'ativa' ? 'Ativa'
                        : a.status === 'pendente' ? 'Pendente'
                        : a.status === 'cancelada' ? 'Cancelada'
                        : a.status === 'inadimplente' ? 'Inadimplente'
                        : a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700">{fmt(a.valorMensal)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(a.venceEm)}</td>
                  <td className="px-4 py-3 text-gray-400">{fmtDate(a.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
