'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda, MESES } from '@/lib/utils'

const ENTIDADES = [
  { key: 'pessoal', label: 'Pessoal', icon: '👤', cor: 'green' },
  { key: 'lar', label: 'Lar', icon: '🏠', cor: 'blue' },
  { key: 'pj', label: 'NC Advogados', icon: '🏢', cor: 'purple' },
] as const

type EntidadeKey = 'pessoal' | 'lar' | 'pj'

type Resumo = {
  receitas: number
  despesas: number
  transacoes: Array<{
    id: string
    tipo: string
    descricao: string
    valor: number
    data: string
    titular?: string | null
    categoria?: { nome: string } | null
  }>
}

const CORES: Record<EntidadeKey, { bg: string; border: string; header: string; badge: string }> = {
  pessoal: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    header: 'bg-green-600',
    badge: 'bg-green-100 text-green-700',
  },
  lar: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    header: 'bg-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
  pj: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    header: 'bg-purple-600',
    badge: 'bg-purple-100 text-purple-700',
  },
}

export default function EntidadesPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [dados, setDados] = useState<Record<EntidadeKey, Resumo> | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandida, setExpandida] = useState<EntidadeKey | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await fetch(`/api/v2/pessoal/entidades?mes=${mes}&ano=${ano}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setDados(await res.json())
    setLoading(false)
  }, [token, mes, ano])

  useEffect(() => { carregar() }, [carregar])

  const totalGeral = dados
    ? ENTIDADES.reduce((s, e) => ({
        receitas: s.receitas + (dados[e.key]?.receitas || 0),
        despesas: s.despesas + (dados[e.key]?.despesas || 0),
      }), { receitas: 0, despesas: 0 })
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900">Multi-Entidade</h1>
            <p className="text-xs text-gray-500">Visão separada por esfera financeira</p>
          </div>
          <select
            value={`${mes}-${ano}`}
            onChange={(e) => { const [m, a] = e.target.value.split('-'); setMes(+m); setAno(+a) }}
            className="px-2 py-1.5 border rounded-lg text-sm"
          >
            {[new Date().getFullYear(), new Date().getFullYear() - 1].flatMap((a) =>
              Array.from({ length: 12 }, (_, i) => (
                <option key={`${i+1}-${a}`} value={`${i + 1}-${a}`}>{MESES[i + 1]} {a}</option>
              ))
            )}
          </select>
        </div>

        {/* Totais gerais */}
        {totalGeral && (
          <div className="flex gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-500">Total receitas:</span>
              <span className="font-semibold text-green-600">{formatarMoeda(totalGeral.receitas)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-gray-500">Total despesas:</span>
              <span className="font-semibold text-red-500">{formatarMoeda(totalGeral.despesas)}</span>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : !dados ? (
          <div className="text-center py-16 text-gray-400">Sem dados.</div>
        ) : (
          <>
            {/* Cards resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {ENTIDADES.map((ent) => {
                const r = dados[ent.key]
                const saldo = r.receitas - r.despesas
                const c = CORES[ent.key]
                const total = r.transacoes.length
                return (
                  <div
                    key={ent.key}
                    className={`bg-white rounded-2xl border ${c.border} shadow-sm overflow-hidden cursor-pointer transition hover:shadow-md`}
                    onClick={() => setExpandida(expandida === ent.key ? null : ent.key)}
                  >
                    <div className={`${c.header} text-white px-4 py-3 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{ent.icon}</span>
                        <span className="font-bold text-sm">{ent.label}</span>
                      </div>
                      <span className="text-xs opacity-80">{total} transaç{total === 1 ? 'ão' : 'ões'}</span>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Receitas</span>
                        <span className="text-sm font-semibold text-green-600">{formatarMoeda(r.receitas)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Despesas</span>
                        <span className="text-sm font-semibold text-red-500">{formatarMoeda(r.despesas)}</span>
                      </div>
                      <div className={`h-px ${c.bg}`} />
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">Saldo</span>
                        <span className={`text-base font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {formatarMoeda(saldo)}
                        </span>
                      </div>
                    </div>
                    {total > 0 && (
                      <div className={`px-4 pb-3 text-xs text-center ${c.badge.split(' ')[1]}`}>
                        {expandida === ent.key ? '▲ Fechar lista' : '▼ Ver transações'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Lista expandida */}
            {expandida && dados[expandida].transacoes.length > 0 && (
              <div className={`bg-white rounded-2xl border ${CORES[expandida].border} shadow-sm p-4`}>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span>{ENTIDADES.find(e => e.key === expandida)?.icon}</span>
                  {ENTIDADES.find(e => e.key === expandida)?.label} — {MESES[mes]}/{ano}
                </h3>
                <div className="space-y-2">
                  {dados[expandida].transacoes.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.tipo === 'receita' ? 'bg-green-500' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{t.descricao}</div>
                        <div className="text-xs text-gray-400 flex gap-2">
                          <span>{new Date(t.data).toLocaleDateString('pt-BR')}</span>
                          {t.categoria && <span>· {t.categoria.nome}</span>}
                          {t.titular && (
                            <span className={`px-1.5 rounded-full ${t.titular === 'matheus' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                              {t.titular === 'matheus' ? '👨' : '👩'}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`font-semibold text-sm flex-shrink-0 ${t.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                        {t.tipo === 'despesa' ? '-' : '+'}{formatarMoeda(t.valor)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Gráfico barra proporcional por entidade */}
                {(() => {
                  const r = dados[expandida]
                  const maxVal = Math.max(r.receitas, r.despesas) || 1
                  return (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16">Receitas</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${(r.receitas / maxVal) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium text-green-600 w-20 text-right">{formatarMoeda(r.receitas)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16">Despesas</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full" style={{ width: `${(r.despesas / maxVal) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium text-red-500 w-20 text-right">{formatarMoeda(r.despesas)}</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Aviso se tudo vazio */}
            {ENTIDADES.every(e => dados[e.key].transacoes.length === 0) && (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">🏷️</div>
                <p className="text-gray-500 mb-2">Nenhuma transação com entidade definida em {MESES[mes]}/{ano}.</p>
                <p className="text-xs text-gray-400">Ao importar ou criar transações, selecione a entidade (Pessoal, Lar ou NC Advogados).</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
