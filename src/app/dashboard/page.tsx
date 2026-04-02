'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda, formatarPercentual, MESES } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts'

export default function DashboardPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const [fechamento, setFechamento] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [alertasContas, setAlertasContas] = useState<{ atrasadas: any[], proximas: any[] }>({ atrasadas: [], proximas: [] })

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'cliente') { router.push('/bpo/dashboard'); return }
    setUsuario(parsed)
  }, [router])

  useEffect(() => {
    if (!usuario) return
    carregarDados()
  }, [usuario, mes, ano])

  async function carregarDados() {
    setLoading(true)
    try {
      const [fech, hist, alrt, alertContas] = await Promise.all([
        api.getFechamento(usuario.id, mes, ano).catch(() => null),
        api.getHistorico(usuario.id, 6).catch(() => []),
        api.getAlertas().catch(() => []),
        api.getAlertasContas().catch(() => ({ atrasadas: [], proximas: [] })),
      ])
      setFechamento(fech?.fechamento || null)
      setHistorico(hist || [])
      setAlertas(alrt || [])
      setAlertasContas(alertContas || { atrasadas: [], proximas: [] })
    } catch {} finally {
      setLoading(false)
    }
  }

  const anterior = historico.length > 1 ? historico[1] : null

  function variacao(atual: number, ant: number) {
    if (!ant || ant === 0) return null
    return ((atual - ant) / Math.abs(ant)) * 100
  }

  const CORES_PIE = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444']

  // Dados do gráfico de linha (inverter para cronológico)
  const dadosGrafico = [...historico].reverse().map((h) => ({
    periodo: `${MESES[h.mes]?.substring(0, 3)}/${String(h.ano).substring(2)}`,
    receita: Number(h.receitaBruta),
    lucroOp: Number(h.lucroOperacional),
    lucroLiq: Number(h.lucroLiquido),
  }))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Radar Financeiro</h1>
          <p className="text-sm text-gray-500">Bom dia! Aqui estão seus números.</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={`${mes}-${ano}`}
            onChange={(e) => { const [m, a] = e.target.value.split('-'); setMes(+m); setAno(+a) }}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const m = i + 1
              return (
                <option key={m} value={`${m}-${ano}`}>{MESES[m]} {ano}</option>
              )
            })}
          </select>
          <nav className="flex gap-2 flex-wrap">
            <button onClick={() => router.push('/estrategia')} className="px-3 py-2 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-medium">✦ Estratégia</button>
            <button onClick={() => router.push('/lancamentos')} className="px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium">↑↓ Lançamentos</button>
            <button onClick={() => router.push('/extrato')} className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium">🏦 Extrato</button>
            <button onClick={() => router.push('/contas')} className={`relative px-3 py-2 text-sm rounded-lg font-medium ${alertasContas.atrasadas.length > 0 ? 'bg-red-100 text-red-700 hover:bg-red-200' : alertasContas.proximas.length > 0 ? 'bg-orange-50 text-orange-700 hover:bg-orange-100' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>
              📋 Contas
              {(alertasContas.atrasadas.length + alertasContas.proximas.length) > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {alertasContas.atrasadas.length + alertasContas.proximas.length}
                </span>
              )}
            </button>
            <button onClick={() => router.push('/pessoal')} className="px-3 py-2 text-sm bg-pink-50 text-pink-700 rounded-lg hover:bg-pink-100 font-medium">💳 Pessoal</button>
            <button onClick={() => router.push('/perguntar')} className="px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">Perguntar</button>
            <button onClick={() => router.push('/relatorio')} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Relatório</button>
            <button onClick={() => router.push('/historico')} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Histórico</button>
            <button onClick={() => { api.logout(); router.push('/login') }} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Sair</button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Alertas de Contas a Pagar */}
        {alertasContas.atrasadas.length > 0 && (
          <div
            onClick={() => router.push('/contas')}
            className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <p className="font-semibold text-red-800">
                  {alertasContas.atrasadas.length} conta{alertasContas.atrasadas.length > 1 ? 's' : ''} em atraso!
                </p>
                <p className="text-sm text-red-600">
                  {alertasContas.atrasadas.map(c => c.descricao).join(', ')}
                </p>
              </div>
            </div>
            <span className="text-red-500 text-sm font-medium">Ver →</span>
          </div>
        )}

        {alertasContas.proximas.filter(c => {
          const d = new Date(c.vencimento); d.setHours(0,0,0,0)
          const h = new Date(); h.setHours(0,0,0,0)
          return d.getTime() === h.getTime()
        }).length > 0 && (
          <div
            onClick={() => router.push('/contas')}
            className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📌</span>
              <div>
                <p className="font-semibold text-orange-800">Conta(s) vence(m) hoje!</p>
                <p className="text-sm text-orange-600">
                  {alertasContas.proximas
                    .filter(c => { const d = new Date(c.vencimento); d.setHours(0,0,0,0); const h = new Date(); h.setHours(0,0,0,0); return d.getTime() === h.getTime() })
                    .map(c => `${c.descricao} (R$ ${Number(c.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})})`)
                    .join(', ')}
                </p>
              </div>
            </div>
            <span className="text-orange-500 text-sm font-medium">Ver →</span>
          </div>
        )}

        {!fechamento ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <p className="text-gray-500 text-lg">Ainda não há dados para {MESES[mes]}/{ano}</p>
            <p className="text-gray-400 text-sm mt-2">Peça ao seu BPO para importar a planilha do mês.</p>
          </div>
        ) : (
          <>
            {/* 4 Cards de Perguntas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Estou ganhando dinheiro? */}
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <p className="text-sm text-gray-500 mb-1">Estou ganhando dinheiro?</p>
                <p className={`text-2xl font-bold ${Number(fechamento.lucroOperacional) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatarMoeda(Number(fechamento.lucroOperacional))}
                </p>
                <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full font-medium ${
                  Number(fechamento.lucroOperacional) >= 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {Number(fechamento.lucroOperacional) >= 0 ? 'POSITIVO' : 'NEGATIVO'}
                </span>
                {anterior && (
                  <p className="text-xs text-gray-400 mt-2">
                    {(() => {
                      const v = variacao(Number(fechamento.lucroOperacional), Number(anterior.lucroOperacional))
                      if (v === null) return ''
                      return `${v >= 0 ? '+' : ''}${v.toFixed(1)}% vs mês anterior`
                    })()}
                  </p>
                )}
              </div>

              {/* Card 2: Meu caixa está seguro? */}
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <p className="text-sm text-gray-500 mb-1">Meu caixa está seguro?</p>
                <p className="text-2xl font-bold text-cyan-600">
                  {fechamento.saldoFinal ? formatarMoeda(Number(fechamento.saldoFinal)) : 'N/D'}
                </p>
                {fechamento.saldoFinal && Number(fechamento.totalDespesasAdm) > 0 && (
                  (() => {
                    const dias = Math.round((Number(fechamento.saldoFinal) / Number(fechamento.totalDespesasAdm)) * 30)
                    const cor = dias > 30 ? 'bg-green-100 text-green-700' : dias > 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    return (
                      <>
                        <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full font-medium ${cor}`}>
                          {dias > 30 ? 'SEGURO' : dias > 15 ? 'ATENÇÃO' : 'RISCO'}
                        </span>
                        <p className="text-xs text-gray-400 mt-2">Cobre ~{dias} dias de operação</p>
                      </>
                    )
                  })()
                )}
              </div>

              {/* Card 3: Onde está indo meu dinheiro? */}
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <p className="text-sm text-gray-500 mb-3">Onde está indo meu dinheiro?</p>
                {[
                  { label: 'Pessoal', valor: Number(fechamento.despesasPessoal), cor: 'bg-blue-500' },
                  { label: 'Marketing', valor: Number(fechamento.despesasMarketing), cor: 'bg-purple-500' },
                  { label: 'Gerais', valor: Number(fechamento.despesasGerais), cor: 'bg-amber-500' },
                ].sort((a, b) => b.valor - a.valor).map((item) => {
                  const perc = Number(fechamento.receitaBruta) > 0
                    ? (item.valor / Number(fechamento.receitaBruta)) * 100
                    : 0
                  return (
                    <div key={item.label} className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="text-gray-500">{formatarPercentual(perc)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`${item.cor} h-2 rounded-full`} style={{ width: `${Math.min(perc * 2, 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Card 4: Qual área me dá mais lucro? */}
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <p className="text-sm text-gray-500 mb-3">Qual área me dá mais lucro?</p>
                {fechamento.resultadosPorSetor && Object.keys(fechamento.resultadosPorSetor).length > 1 ? (
                  <div className="flex items-center justify-center h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(fechamento.resultadosPorSetor)
                            .filter(([_, v]: any) => v.receita > 0)
                            .map(([k, v]: any) => ({ name: k, value: v.receita }))}
                          cx="50%" cy="50%" innerRadius={30} outerRadius={50}
                          dataKey="value" paddingAngle={2}
                        >
                          {Object.keys(fechamento.resultadosPorSetor).map((_, i) => (
                            <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center mt-4">
                    <p className="text-lg font-bold text-indigo-600">
                      {formatarPercentual(Number(fechamento.percMargem))}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Margem de contribuição</p>
                  </div>
                )}
              </div>
            </div>

            {/* Gráfico Principal */}
            {dadosGrafico.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Evolução — Últimos {dadosGrafico.length} meses</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dadosGrafico}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="periodo" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Line type="monotone" dataKey="receita" stroke="#3b82f6" name="Receita" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="lucroOp" stroke="#10b981" name="Lucro Op." strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="lucroLiq" stroke="#f59e0b" name="Lucro Líq." strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Alertas */}
            {alertas.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">Alertas</h2>
                {alertas.map((a: any) => (
                  <div key={a.id} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between">
                    <div>
                      <p className="font-medium text-red-800">{a.titulo}</p>
                      <p className="text-sm text-red-600 mt-1">{a.mensagem}</p>
                    </div>
                    <button
                      onClick={async () => { await api.marcarAlertaVisto(a.id); setAlertas(alertas.filter((x: any) => x.id !== a.id)) }}
                      className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap ml-4"
                    >
                      Entendi
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
