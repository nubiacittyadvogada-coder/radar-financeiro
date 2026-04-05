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

type Transacao = {
  id: string
  tipo: string
  descricao: string
  valor: number
  data: string
  titular?: string | null
  categoria?: { nome: string } | null
}

type Resumo = {
  receitas: number
  despesas: number
  transacoes: Transacao[]
}

const COR = {
  pessoal: { aba: 'bg-green-600 text-white', abainativa: 'text-green-700 hover:bg-green-50', header: 'bg-green-600', borda: 'border-green-200', badge: 'bg-green-100 text-green-700', barra: 'bg-green-500' },
  lar: { aba: 'bg-blue-600 text-white', abainativa: 'text-blue-700 hover:bg-blue-50', header: 'bg-blue-600', borda: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', barra: 'bg-blue-500' },
  pj: { aba: 'bg-purple-600 text-white', abainativa: 'text-purple-700 hover:bg-purple-50', header: 'bg-purple-600', borda: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', barra: 'bg-purple-500' },
}

export default function EntidadesPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [dados, setDados] = useState<Record<EntidadeKey, Resumo> | null>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<EntidadeKey>('pessoal')

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

  const entAtual = ENTIDADES.find(e => e.key === aba)!
  const cor = COR[aba]
  const resumo = dados?.[aba]

  const totalGeral = dados
    ? {
        receitas: ENTIDADES.reduce((s, e) => s + (dados[e.key]?.receitas || 0), 0),
        despesas: ENTIDADES.reduce((s, e) => s + (dados[e.key]?.despesas || 0), 0),
      }
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900">Multi-Entidade</h1>
            {totalGeral && (
              <p className="text-xs text-gray-500">
                Total · Receitas: {formatarMoeda(totalGeral.receitas)} · Despesas: {formatarMoeda(totalGeral.despesas)}
              </p>
            )}
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

        {/* Abas de entidade */}
        <div className="flex gap-2">
          {ENTIDADES.map((e) => {
            const ativo = aba === e.key
            const c = COR[e.key]
            const total = dados?.[e.key]?.transacoes.length || 0
            return (
              <button
                key={e.key}
                onClick={() => setAba(e.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition flex-1 justify-center ${
                  ativo ? c.aba : `bg-gray-100 ${c.abainativa}`
                }`}
              >
                <span>{e.icon}</span>
                <span className="hidden sm:inline">{e.label}</span>
                {total > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${ativo ? 'bg-white/20' : 'bg-gray-200 text-gray-600'}`}>
                    {total}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : !dados || !resumo ? (
          <div className="text-center py-16 text-gray-400">Sem dados.</div>
        ) : (
          <>
            {/* KPIs da entidade selecionada */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Receitas', value: resumo.receitas, cor: 'text-green-600' },
                { label: 'Despesas', value: resumo.despesas, cor: 'text-red-500' },
                { label: 'Saldo', value: resumo.receitas - resumo.despesas, cor: resumo.receitas - resumo.despesas >= 0 ? 'text-green-600' : 'text-red-500' },
              ].map((k) => (
                <div key={k.label} className="bg-white rounded-xl p-3 shadow-sm border text-center">
                  <div className="text-xs text-gray-500 mb-1">{k.label}</div>
                  <div className={`text-base font-bold ${k.cor}`}>{formatarMoeda(k.value)}</div>
                </div>
              ))}
            </div>

            {/* Barra proporcional */}
            {(resumo.receitas > 0 || resumo.despesas > 0) && (() => {
              const max = Math.max(resumo.receitas, resumo.despesas) || 1
              return (
                <div className="bg-white rounded-xl p-4 shadow-sm border mb-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16">Receitas</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full bg-green-500 rounded-full`} style={{ width: `${(resumo.receitas / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium text-green-600 w-24 text-right">{formatarMoeda(resumo.receitas)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16">Despesas</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full bg-red-400 rounded-full`} style={{ width: `${(resumo.despesas / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium text-red-500 w-24 text-right">{formatarMoeda(resumo.despesas)}</span>
                  </div>
                </div>
              )
            })()}

            {/* Lista de transações */}
            {resumo.transacoes.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">{entAtual.icon}</div>
                <p className="text-gray-500 mb-2">Nenhuma transação em <strong>{entAtual.label}</strong> em {MESES[mes]}/{ano}.</p>
                <p className="text-xs text-gray-400">Ao criar ou importar transações, selecione a entidade <strong>{entAtual.label}</strong>.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className={`${cor.header} text-white px-4 py-2.5 flex items-center justify-between`}>
                  <span className="font-semibold text-sm">{entAtual.icon} {entAtual.label} — {MESES[mes]}/{ano}</span>
                  <span className="text-xs opacity-80">{resumo.transacoes.length} transaç{resumo.transacoes.length === 1 ? 'ão' : 'ões'}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {resumo.transacoes.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.tipo === 'receita' ? 'bg-green-500' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{t.descricao}</div>
                        <div className="text-xs text-gray-400 flex gap-2 items-center">
                          <span>{new Date(t.data).toLocaleDateString('pt-BR')}</span>
                          {t.categoria && <span>· {t.categoria.nome}</span>}
                          {t.titular && (
                            <span className={`px-1.5 rounded-full text-xs ${t.titular === 'matheus' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                              {t.titular === 'matheus' ? '👨 Matheus' : '👩 Nubia'}
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
              </div>
            )}

            {/* Mini resumo de todas as entidades */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {ENTIDADES.map((e) => {
                const r = dados[e.key]
                const saldo = r.receitas - r.despesas
                const c = COR[e.key]
                const isAtiva = aba === e.key
                return (
                  <button
                    key={e.key}
                    onClick={() => setAba(e.key)}
                    className={`rounded-xl p-3 text-center border transition ${isAtiva ? `${c.borda} bg-white shadow-sm ring-1 ${c.borda}` : 'border-gray-100 bg-white hover:shadow-sm'}`}
                  >
                    <div className="text-xl mb-1">{e.icon}</div>
                    <div className="text-xs text-gray-500 font-medium mb-1">{e.label}</div>
                    <div className={`text-sm font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatarMoeda(saldo)}</div>
                    <div className="text-xs text-gray-400">{r.transacoes.length} transaç{r.transacoes.length === 1 ? 'ão' : 'ões'}</div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
