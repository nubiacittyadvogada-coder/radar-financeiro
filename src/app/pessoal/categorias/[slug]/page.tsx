'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

const MESES_NOMES: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
}

export default function CategoriaDetalhe() {
  const router = useRouter()
  const params = useParams()
  const slug = decodeURIComponent(params.slug as string)

  const [token, setToken] = useState<string | null>(null)
  const [dados, setDados] = useState<any>(null)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [mesSelecionado, setMesSelecionado] = useState<number | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    if (JSON.parse(u).tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await fetch(`/api/v2/pessoal/categorias/${encodeURIComponent(slug)}?ano=${ano}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setDados(await res.json())
    setLoading(false)
  }, [token, slug, ano])

  useEffect(() => { carregar() }, [carregar])

  const anos = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]
  const isReceita = dados?.tipo === 'receita'
  const cor = isReceita ? 'text-green-600' : 'text-blue-600'
  const bg = isReceita ? 'bg-green-600' : 'bg-blue-600'
  const maxMes = dados?.porMes ? Math.max(...dados.porMes.map((m: any) => m.total), 1) : 1

  const txMesSel = mesSelecionado !== null
    ? dados?.porMes?.find((m: any) => m.mes === mesSelecionado)?.transacoes || []
    : []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">← Voltar</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{slug}</h1>
          <p className="text-sm text-gray-500">Histórico detalhado por categoria</p>
        </div>
        <select value={ano} onChange={(e) => setAno(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : !dados || dados.porMes?.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border">
            <div className="text-4xl mb-3">🗂️</div>
            <p className="text-gray-500">Nenhuma transação em {ano} para esta categoria.</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Total {ano}</div>
                <div className={`text-xl font-bold ${cor}`}>{formatarMoeda(dados.totalAno)}</div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Média mensal</div>
                <div className="text-xl font-bold text-gray-800">{formatarMoeda(dados.mediasMes)}</div>
                <div className="text-xs text-gray-400">{dados.porMes?.length} meses com dados</div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Maior mês</div>
                {dados.porMes?.length > 0 && (() => {
                  const maior = [...dados.porMes].sort((a: any, b: any) => b.total - a.total)[0]
                  return (
                    <>
                      <div className="text-xl font-bold text-gray-800">{formatarMoeda(maior.total)}</div>
                      <div className="text-xs text-gray-400">{MESES_NOMES[maior.mes]}/{ano}</div>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Gráfico de barras mês a mês */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h3 className="text-sm font-semibold text-gray-700">Mês a Mês — {ano}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Clique em um mês para ver as transações</p>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-end gap-2 h-36">
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = i + 1
                    const d = dados.porMes?.find((x: any) => x.mes === m)
                    const pct = d ? (d.total / maxMes) * 100 : 0
                    const isSel = mesSelecionado === m
                    return (
                      <div
                        key={m}
                        className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                        onClick={() => setMesSelecionado(isSel ? null : m)}
                      >
                        <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
                          <div
                            className={`w-full rounded-t transition-all ${isSel ? 'opacity-100 ring-2 ring-offset-1 ring-blue-400' : 'opacity-80 group-hover:opacity-100'}`}
                            style={{ height: `${Math.max(pct, d ? 4 : 0)}%`, backgroundColor: d ? (isReceita ? '#16a34a' : '#3b82f6') : '#f3f4f6' }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{MESES_NOMES[m]}</span>
                        {d && <span className="text-xs font-medium text-gray-700 hidden group-hover:block absolute -mt-6 bg-white border rounded px-1 shadow text-nowrap">
                          {formatarMoeda(d.total)}
                        </span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Transações do mês selecionado */}
            {mesSelecionado !== null && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {MESES_NOMES[mesSelecionado]}/{ano} — {formatarMoeda(dados.porMes?.find((m: any) => m.mes === mesSelecionado)?.total || 0)}
                  </h3>
                  <button onClick={() => setMesSelecionado(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ fechar</button>
                </div>
                <div className="divide-y max-h-80 overflow-y-auto">
                  {txMesSel.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-gray-400">Nenhuma transação neste mês.</p>
                  ) : txMesSel.map((t: any, i: number) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate">{t.descricao || '—'}</div>
                        <div className="text-xs text-gray-400">
                          {t.data ? new Date(t.data).toLocaleDateString('pt-BR') : ''}
                          {t.origem === 'cartao' && <span className="ml-2 bg-blue-100 text-blue-600 px-1 rounded text-xs">💳 CC</span>}
                        </div>
                      </div>
                      <span className={`text-sm font-semibold flex-shrink-0 ${t.tipo === 'receita' ? 'text-green-600' : 'text-gray-800'}`}>
                        {t.tipo === 'receita' ? '+' : ''}{formatarMoeda(t.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top 5 maiores */}
            {dados.top5?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-5 py-4 border-b">
                  <h3 className="text-sm font-semibold text-gray-700">Maiores transações de {ano}</h3>
                </div>
                <div className="divide-y">
                  {dados.top5.map((t: any, i: number) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 truncate">{t.descricao || '—'}</div>
                        <div className="text-xs text-gray-400">
                          {t.data ? new Date(t.data).toLocaleDateString('pt-BR') : ''} · {MESES_NOMES[t.mes]}/{ano}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-800 flex-shrink-0">{formatarMoeda(t.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
