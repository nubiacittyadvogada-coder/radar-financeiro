'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

const MESES_PT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

type Parcela = {
  nome: string
  categoria: string | null
  parcelaAtual: number
  totalParcelas: number
  restantes: number
  valorMensal: number
  totalFuturo: number
  mesFim: number
  anoFim: number
  encerrado: boolean
}

type Dados = {
  mapa: Parcela[]
  totalMensal: number
  totalGlobal: number
}

export default function ParcelasPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('radar_token')
    const u = localStorage.getItem('radar_usuario')
    if (!t || !u) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/v2/pessoal/parcelas', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setDados(await res.json())
    } catch {} finally { setLoading(false) }
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  // Agrupar por mês de encerramento para semáforo
  const hoje = new Date()
  const proximos6Meses: { mes: number; ano: number; label: string; total: number }[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
    proximos6Meses.push({
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
      label: `${MESES_PT[d.getMonth() + 1]}/${String(d.getFullYear()).slice(2)}`,
      total: 0,
    })
  }

  // Calcular quanto vence em cada mês futuro
  if (dados?.mapa) {
    for (const p of dados.mapa) {
      for (const m of proximos6Meses) {
        // Esta parcela está ativa neste mês?
        const ultimaMes = p.totalParcelas - p.restantes // mês da última registrada = parcelaAtual
        // Simplificado: se o mês está entre agora e mesFim, essa parcela existe
        const dataM = new Date(m.ano, m.mes - 1, 1)
        const dataFim = new Date(p.anoFim, p.mesFim - 1, 1)
        if (dataM <= dataFim) {
          m.total += p.valorMensal
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-lg font-bold text-gray-900">📦 Mapa de Parcelas</h1>
          <p className="text-sm text-gray-500">Compromissos futuros do cartão de crédito</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 md:px-6 py-4 md:py-6 space-y-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Calculando parcelas...</div>
        ) : !dados || dados.mapa.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-lg font-semibold text-gray-800">Sem parcelas ativas</div>
            <div className="text-sm text-gray-500 mt-1">Nenhuma compra parcelada em aberto encontrada.</div>
            <div className="text-xs text-gray-400 mt-3">Importe faturas CC com compras parceladas para ver o mapa.</div>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Comprometido/mês</div>
                <div className="text-2xl font-bold text-orange-500">{formatarMoeda(dados.totalMensal)}</div>
                <div className="text-xs text-gray-400 mt-0.5">todo mês no cartão</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Total futuro</div>
                <div className="text-2xl font-bold text-red-500">{formatarMoeda(dados.totalGlobal)}</div>
                <div className="text-xs text-gray-400 mt-0.5">ainda vai sair do bolso</div>
              </div>
            </div>

            {/* Semáforo dos próximos 6 meses */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">🚦 Compromisso por mês</h3>
                <p className="text-xs text-gray-400 mt-0.5">Quanto do cartão está comprometido nos próximos 6 meses</p>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-6 gap-2">
                  {proximos6Meses.map((m, i) => {
                    const pct = dados.totalMensal > 0 ? (m.total / dados.totalMensal) * 100 : 0
                    const cor = m.total === 0 ? 'bg-gray-100 text-gray-400' :
                      m.total > dados.totalMensal * 0.8 ? 'bg-red-100 text-red-700' :
                      m.total > dados.totalMensal * 0.4 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    return (
                      <div key={i} className={`rounded-lg p-2 text-center ${cor}`}>
                        <div className="text-xs font-semibold">{m.label}</div>
                        <div className="text-xs font-bold mt-0.5">
                          {m.total > 0 ? formatarMoeda(m.total).replace('R$\u00a0', 'R$') : '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-400 justify-center">
                  <span>🔴 alto</span>
                  <span>🟡 médio</span>
                  <span>🟢 baixo</span>
                </div>
              </div>
            </div>

            {/* Mapa detalhado */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Todas as parcelas ativas</h3>
                <p className="text-xs text-gray-400 mt-0.5">{dados.mapa.length} compras parceladas em aberto</p>
              </div>
              <div className="divide-y">
                {dados.mapa.map((p, i) => {
                  const progresso = ((p.parcelaAtual / p.totalParcelas) * 100)
                  return (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{p.nome}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            Parcela {p.parcelaAtual}/{p.totalParcelas} · termina {MESES_PT[p.mesFim]}/{String(p.anoFim).slice(2)}
                            {p.categoria && <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{p.categoria}</span>}
                          </div>
                          <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded-full"
                              style={{ width: `${progresso}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-gray-800">{formatarMoeda(p.valorMensal)}/mês</div>
                          <div className="text-xs text-red-500 font-medium mt-0.5">
                            {formatarMoeda(p.totalFuturo)} restante
                          </div>
                          <div className="text-xs text-gray-400">{p.restantes}x ainda</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Total comprometido</span>
                <span className="text-sm font-bold text-red-600">{formatarMoeda(dados.totalGlobal)}</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              💡 <strong>Dica:</strong> Antes de nova compra parcelada, considere: você já tem {formatarMoeda(dados.totalMensal)}/mês comprometido. Nova parcela vai somar a isso por meses.
            </div>
          </>
        )}
      </main>
    </div>
  )
}
