'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda, MESES } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const CORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']

function VistaAnual({ ano, dados }: { ano: number; dados: any[] }) {
  const totalReceitas = dados.reduce((s, d) => s + d.receitas, 0)
  const totalDespesas = dados.reduce((s, d) => s + d.despesas, 0)
  const totalCartao = dados.reduce((s, d) => s + (d.cartao || 0), 0)
  const saldoAnual = totalReceitas - totalDespesas
  const maxVal = Math.max(...dados.map((d) => Math.max(d.receitas, d.despesas + (d.cartao || 0))), 1)
  const temCartao = dados.some((d) => (d.cartao || 0) > 0)

  if (dados.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center shadow-sm border">
        <div className="text-4xl mb-4">📅</div>
        <h2 className="text-lg font-semibold text-gray-800">Nenhum dado em {ano}</h2>
        <p className="text-gray-500 mt-2">Importe extratos para ver o resumo anual.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs anuais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Receitas {ano}</div>
          <div className="text-xl font-bold text-green-600">{formatarMoeda(totalReceitas)}</div>
          <div className="text-xs text-gray-400 mt-1">Média: {formatarMoeda(totalReceitas / dados.length)}/mês</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Despesas extrato</div>
          <div className="text-xl font-bold text-red-500">{formatarMoeda(totalDespesas)}</div>
          <div className="text-xs text-gray-400 mt-1">Média: {formatarMoeda(totalDespesas / dados.length)}/mês</div>
        </div>
        {temCartao && (
          <div className="bg-white rounded-xl p-5 shadow-sm border">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cartão (faturas)</div>
            <div className="text-xl font-bold text-blue-600">{formatarMoeda(totalCartao)}</div>
            <div className="text-xs text-gray-400 mt-1">
              {totalReceitas > 0 ? ((totalCartao / totalReceitas) * 100).toFixed(0) : 0}% das receitas
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Saldo {ano}</div>
          <div className={`text-xl font-bold ${saldoAnual >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatarMoeda(saldoAnual)}</div>
          <div className="text-xs text-gray-400 mt-1">Taxa poupança: {totalReceitas > 0 ? ((saldoAnual / totalReceitas) * 100).toFixed(0) : 0}%</div>
        </div>
      </div>

      {/* Destaques — meses críticos e melhores */}
      {dados.length >= 2 && (() => {
        const comDados = dados.filter((d) => d.receitas > 0)
        const sorted = [...comDados].sort((a, b) => (a.receitas - a.despesas) - (b.receitas - b.despesas))
        const piores = sorted.slice(0, Math.min(3, sorted.length))
        const melhores = [...sorted].reverse().slice(0, Math.min(2, sorted.length))
        return (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-red-50 rounded-xl border border-red-100 p-4">
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">📉 Meses com menor saldo</h3>
              <div className="space-y-2">
                {piores.map((d) => {
                  const saldo = d.receitas - d.despesas
                  const taxa = d.receitas > 0 ? ((saldo / d.receitas) * 100).toFixed(0) : '0'
                  return (
                    <div key={`${d.mes}-${d.ano}`} className="flex items-center justify-between">
                      <span className="text-sm text-red-800 font-medium">{MESES[d.mes]}</span>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {saldo >= 0 ? '+' : ''}{formatarMoeda(saldo)}
                        </span>
                        <span className="text-xs text-red-500 ml-2">({taxa}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-100 p-4">
              <h3 className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3">📈 Meses com melhor saldo</h3>
              <div className="space-y-2">
                {melhores.map((d) => {
                  const saldo = d.receitas - d.despesas
                  const taxa = d.receitas > 0 ? ((saldo / d.receitas) * 100).toFixed(0) : '0'
                  return (
                    <div key={`${d.mes}-${d.ano}`} className="flex items-center justify-between">
                      <span className="text-sm text-green-800 font-medium">{MESES[d.mes]}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-green-600">+{formatarMoeda(saldo)}</span>
                        <span className="text-xs text-green-500 ml-2">({taxa}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tabela mês a mês */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Mês a Mês — {ano}</h3>
        </div>
        <div className="divide-y">
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1
            const d = dados.find((x) => x.mes === m)
            if (!d) return (
              <div key={m} className="px-5 py-3 flex items-center gap-4 text-gray-300">
                <span className="w-20 text-sm">{MESES[m]}</span>
                <span className="text-xs">—</span>
              </div>
            )
            const saldo = d.receitas - d.despesas
            const cartaoMes = d.cartao || 0
            const rPct = (d.receitas / maxVal) * 100
            const dPct = (d.despesas / maxVal) * 100
            const cPct = (cartaoMes / maxVal) * 100
            const taxaPoupanca = d.receitas > 0 ? ((saldo / d.receitas) * 100) : 0
            const bgRow = saldo < 0 ? 'bg-red-50' : taxaPoupanca < 10 ? 'bg-amber-50' : ''
            return (
              <div key={m} className={`px-5 py-3 ${bgRow}`}>
                <div className="flex items-start gap-3">
                  <div className="w-20 flex-shrink-0 pt-1">
                    <span className="text-sm text-gray-600">{MESES[m]}</span>
                    {saldo < 0 && <div className="text-xs text-red-500 font-medium">negativo</div>}
                    {saldo >= 0 && taxaPoupanca < 10 && <div className="text-xs text-amber-500">baixo</div>}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${rPct}%`, minWidth: '4px' }} />
                      <span className="text-xs text-green-600 font-medium flex-shrink-0">{formatarMoeda(d.receitas)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-red-400 transition-all" style={{ width: `${dPct}%`, minWidth: '4px' }} />
                      <span className="text-xs text-red-500 font-medium flex-shrink-0">{formatarMoeda(d.despesas)}</span>
                    </div>
                    {cartaoMes > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded-full bg-blue-400 transition-all" style={{ width: `${cPct}%`, minWidth: '4px' }} />
                        <span className="text-xs text-blue-500 font-medium flex-shrink-0">💳 {formatarMoeda(cartaoMes)}</span>
                        {d.receitas > 0 && <span className="text-xs text-gray-400">({((cartaoMes / d.receitas) * 100).toFixed(0)}%)</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 w-28">
                    <span className={`text-sm font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {saldo >= 0 ? '+' : ''}{formatarMoeda(saldo)}
                    </span>
                    <div className="text-xs text-gray-400">{taxaPoupanca.toFixed(0)}% poupado</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {/* Totais */}
        <div className="px-5 py-3 bg-gray-50 border-t">
          <div className="flex items-center gap-3">
            <span className="w-20 text-sm font-bold text-gray-700">Total</span>
            <div className="flex-1 flex flex-wrap gap-3 text-sm">
              <span className="text-green-600 font-medium">{formatarMoeda(totalReceitas)}</span>
              <span className="text-red-500 font-medium">{formatarMoeda(totalDespesas)}</span>
              {temCartao && <span className="text-blue-500 font-medium">💳 {formatarMoeda(totalCartao)}</span>}
            </div>
            <span className={`text-sm font-bold w-24 text-right ${saldoAnual >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {saldoAnual >= 0 ? '+' : ''}{formatarMoeda(saldoAnual)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children, onClick }: { title: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border ${onClick ? 'cursor-pointer hover:shadow-md transition' : ''}`} onClick={onClick}>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}

export default function PessoalDashboard() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [usuario, setUsuario] = useState<any>(null)
  const [resumo, setResumo] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [vistaAnual, setVistaAnual] = useState(false)
  const [resumoAnual, setResumoAnual] = useState<any[]>([])
  const [saldoConta, setSaldoConta] = useState<number | null>(null)
  const [saldoContaEm, setSaldoContaEm] = useState<string | null>(null)
  const [editandoSaldo, setEditandoSaldo] = useState(false)
  const [novoSaldo, setNovoSaldo] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setUsuario(parsed)
    setToken(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const h = { Authorization: `Bearer ${token}` }
    try {
      const [resRes, histRes, contaRes] = await Promise.all([
        fetch(`/api/v2/pessoal/resumo?mes=${mes}&ano=${ano}`, { headers: h }),
        fetch(`/api/v2/pessoal/historico?meses=24`, { headers: h }),
        fetch(`/api/v2/pessoal/conta`, { headers: h }),
      ])
      if (resRes.ok) setResumo(await resRes.json())
      else setResumo(null)
      if (histRes.ok) {
        const hist = await histRes.json()
        setHistorico(hist)
        setResumoAnual(hist.filter((h: any) => h.ano === ano))
      }
      if (contaRes.ok) {
        const conta = await contaRes.json()
        setSaldoConta(conta.saldoConta)
        setSaldoContaEm(conta.saldoContaEm)
      }
    } catch {} finally { setLoading(false) }
  }, [token, mes, ano])

  async function salvarSaldo() {
    if (!token) return
    const valor = parseFloat(novoSaldo.replace(',', '.'))
    if (isNaN(valor)) return
    const res = await fetch('/api/v2/pessoal/conta', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ saldoConta: valor }),
    })
    if (res.ok) {
      const d = await res.json()
      setSaldoConta(d.saldoConta)
      setSaldoContaEm(d.saldoContaEm)
    }
    setEditandoSaldo(false)
    setNovoSaldo('')
  }

  useEffect(() => { carregar() }, [carregar])

  // Merge banco + CC nas categorias para visão completa
  const catBanco = resumo?.porCategoria?.filter((c: any) => c.tipo === 'despesa') || []
  const catCartao = resumo?.cartao?.porCategoria || []
  const catMergeMap = new Map<string, number>()
  for (const c of catBanco) catMergeMap.set(c.nome, (catMergeMap.get(c.nome) || 0) + c.total)
  for (const c of catCartao) catMergeMap.set(c.nome, (catMergeMap.get(c.nome) || 0) + c.total)
  const despesasPorCat = Array.from(catMergeMap.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 9)

  const totalGasto = (resumo?.totalDespesas || 0) + (resumo?.cartao?.total || 0)
  const saldoReal = (resumo?.totalReceitas || 0) - totalGasto

  const pieDados = despesasPorCat.map((c: any) => ({ name: c.nome, value: c.total }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
        <div className="hidden md:block">
          <h1 className="text-xl font-bold text-gray-900">Finanças Pessoais</h1>
          {usuario && <p className="text-sm text-gray-500">{usuario.nome}</p>}
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex rounded-lg border overflow-hidden text-sm">
            <button onClick={() => setVistaAnual(false)} className={`px-3 py-1.5 font-medium ${!vistaAnual ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Mês</button>
            <button onClick={() => setVistaAnual(true)} className={`px-3 py-1.5 font-medium ${vistaAnual ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Ano</button>
          </div>
          {vistaAnual ? (
            <select value={ano} onChange={(e) => setAno(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          ) : (
            <select
              value={`${mes}-${ano}`}
              onChange={(e) => { const [m, a] = e.target.value.split('-'); setMes(+m); setAno(+a) }}
              className="px-2 py-2 border rounded-lg text-sm max-w-[160px]"
            >
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].flatMap((a) =>
                Array.from({ length: 12 }, (_, i) => (
                  <option key={`${i+1}-${a}`} value={`${i + 1}-${a}`}>{MESES[i + 1]} {a}</option>
                ))
              )}
            </select>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 md:px-6 py-4 md:py-8 space-y-4 md:space-y-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : vistaAnual ? (
          <VistaAnual ano={ano} dados={resumoAnual} />
        ) : !resumo || (resumo.totalReceitas === 0 && resumo.totalDespesas === 0) ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border text-center">
              <div className="text-3xl mb-3">📂</div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">Sem dados em {MESES[mes]}/{ano}</h2>
              <p className="text-sm text-gray-500 mb-4">Importe o extrato PDF ou a fatura do cartão para este mês.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => router.push('/pessoal/transacoes')}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  📄 Importar extrato
                </button>
                <button onClick={() => router.push('/pessoal/transacoes')}
                  className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">
                  💳 Importar fatura
                </button>
              </div>
            </div>
            {/* Mostra mini-resumo dos últimos meses mesmo sem dados no mês atual */}
            {historico.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-5 py-3 border-b">
                  <h3 className="text-sm font-semibold text-gray-700">Últimos meses com dados</h3>
                </div>
                <div className="divide-y">
                  {[...historico].reverse().slice(0, 4).map((h: any) => {
                    const saldo = h.receitas - h.despesas
                    return (
                      <button
                        key={`${h.mes}-${h.ano}`}
                        onClick={() => { setMes(h.mes); setAno(h.ano) }}
                        className="w-full px-5 py-3 flex items-center gap-4 hover:bg-gray-50 text-left"
                      >
                        <span className="w-28 text-sm text-gray-600">{MESES[h.mes]} {h.ano}</span>
                        <div className="flex-1 flex gap-4 text-xs">
                          <span className="text-green-600">{formatarMoeda(h.receitas)}</span>
                          <span className="text-red-500">{formatarMoeda(h.despesas)}</span>
                        </div>
                        <span className={`text-sm font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {saldo >= 0 ? '+' : ''}{formatarMoeda(saldo)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="px-5 py-2 bg-gray-50 border-t text-center">
                  <button onClick={() => setVistaAnual(true)} className="text-xs text-green-600 font-medium hover:underline">
                    Ver todos os meses →
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Saldo em conta (real) */}
            <div className="bg-white rounded-xl border shadow-sm px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">💰 Saldo em conta (banco)</div>
                {editandoSaldo ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 657.32"
                      value={novoSaldo}
                      onChange={(e) => setNovoSaldo(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && salvarSaldo()}
                      className="border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-green-500"
                      autoFocus
                    />
                    <button onClick={salvarSaldo} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg font-medium">Salvar</button>
                    <button onClick={() => setEditandoSaldo(false)} className="px-3 py-1.5 text-gray-500 text-sm">Cancelar</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-bold ${saldoConta !== null ? (saldoConta >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-300'}`}>
                      {saldoConta !== null ? formatarMoeda(saldoConta) : 'Não definido'}
                    </span>
                    {saldoContaEm && (
                      <span className="text-xs text-gray-400">
                        atualizado {new Date(saldoContaEm).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {!editandoSaldo && (
                <button
                  onClick={() => { setEditandoSaldo(true); setNovoSaldo(saldoConta !== null ? String(saldoConta) : '') }}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex-shrink-0"
                >
                  ✏️ Atualizar
                </button>
              )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <Card title="Receitas">
                <div className="text-xl font-bold text-green-600">{formatarMoeda(resumo.totalReceitas)}</div>
              </Card>
              <Card title="Gastos totais">
                <div className="text-xl font-bold text-red-500">{formatarMoeda(totalGasto)}</div>
                {resumo.cartao?.total > 0 && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    Banco {formatarMoeda(resumo.totalDespesas)} + CC {formatarMoeda(resumo.cartao.total)}
                  </div>
                )}
              </Card>
              <Card title="Saldo do Mês">
                <div className={`text-xl font-bold ${saldoReal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatarMoeda(saldoReal)}
                </div>
                {resumo.cartao?.total > 0 && (
                  <div className="text-xs text-gray-400 mt-0.5">inclui fatura CC</div>
                )}
              </Card>
            </div>

            {/* Gráfico + Maiores categorias */}
            <div className="grid md:grid-cols-2 gap-4">
              {pieDados.length > 0 && (
                <Card title="Despesas por categoria">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieDados} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={false}>
                        {pieDados.map((_: any, i: number) => (
                          <Cell key={i} fill={CORES[i % CORES.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatarMoeda(v)} />
                      <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              )}

              <Card title="Por categoria (banco + CC)">
                <div className="space-y-2">
                  {despesasPorCat.map((c: any, i: number) => {
                    const pct = totalGasto > 0 ? (c.total / totalGasto) * 100 : 0
                    return (
                      <div key={c.id}>
                        <div className="flex justify-between text-sm mb-0.5">
                          <span className="text-gray-600 truncate max-w-[160px]">{c.nome}</span>
                          <span className="font-medium text-gray-800">{formatarMoeda(c.total)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: CORES[i % CORES.length] }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>

            {/* Alertas do mês */}
            {resumo.alertas?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-5 py-3 border-b flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <h3 className="text-sm font-semibold text-gray-700">Alertas do mês</h3>
                  <span className="ml-auto text-xs text-gray-400">vs média dos 3 meses anteriores</span>
                </div>
                <div className="divide-y">
                  {resumo.alertas.map((a: any) => (
                    <div key={a.categoria} className="px-5 py-3 flex items-center gap-3">
                      <span className="text-lg flex-shrink-0">{a.tipo === 'acima' ? '🔴' : '🟢'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{a.categoria}</div>
                        <div className="text-xs text-gray-400">
                          Média: {formatarMoeda(a.media)} → Este mês: {formatarMoeda(a.atual)}
                        </div>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${a.tipo === 'acima' ? 'text-red-500' : 'text-green-600'}`}>
                        {a.tipo === 'acima' ? '+' : ''}{a.variacao.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Orçamentos */}
            {resumo.orcamentos?.length > 0 && (
              <Card title="Orçamentos do mês" onClick={() => router.push('/pessoal/orcamento')}>
                <div className="space-y-3">
                  {resumo.orcamentos.map((o: any) => {
                    const pct = Math.min(100, (Number(o.valorGasto) / Number(o.valorMeta)) * 100)
                    const estourou = pct >= 100
                    return (
                      <div key={o.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{o.categoria?.nome}</span>
                          <span className={`text-xs ${estourou ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            {formatarMoeda(o.valorGasto)} / {formatarMoeda(o.valorMeta)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${estourou ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Cartão de Crédito */}
            {resumo.cartao && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-5 py-4 border-b bg-blue-50 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-blue-800">💳 {resumo.cartao.nome || 'Cartão de Crédito'}</h3>
                    <p className="text-xs text-blue-600 mt-0.5">Detalhamento da fatura — não duplica com as despesas do extrato</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-700">{formatarMoeda(resumo.cartao.total)}</div>
                    {resumo.totalReceitas > 0 && (
                      <div className="text-xs text-blue-500 mt-0.5">
                        {((resumo.cartao.total / resumo.totalReceitas) * 100).toFixed(0)}% da receita do mês
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {resumo.cartao.porCategoria.map((c: any, i: number) => {
                    const pct = resumo.cartao.total > 0 ? (c.total / resumo.cartao.total) * 100 : 0
                    return (
                      <div key={c.nome}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">{c.nome}</span>
                          <div className="text-right">
                            <span className="font-medium text-gray-800">{formatarMoeda(c.total)}</span>
                            <span className="text-xs text-gray-400 ml-2">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CORES[i % CORES.length] }} />
                        </div>
                      </div>
                    )
                  })}
                  {resumo.totalReceitas > 0 && (
                    <div className="pt-3 border-t flex items-center justify-between text-sm">
                      <span className="text-gray-500">Saídas totais do mês <span className="text-xs">(extrato + fatura)</span></span>
                      <span className="font-bold text-gray-800">{formatarMoeda(resumo.totalDespesas + resumo.cartao.total)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ações rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Nova transação', icon: '➕', href: '/pessoal/transacoes' },
                { label: 'Ver orçamento', icon: '📊', href: '/pessoal/orcamento' },
                { label: 'Minhas metas', icon: '🎯', href: '/pessoal/metas' },
                { label: 'Perguntar à IA', icon: '🤖', href: '/pessoal/perguntar' },
              ].map((a) => (
                <button
                  key={a.href}
                  onClick={() => router.push(a.href)}
                  className="bg-white border rounded-xl px-4 py-4 text-center hover:shadow-md transition"
                >
                  <div className="text-2xl mb-1">{a.icon}</div>
                  <div className="text-xs font-medium text-gray-700">{a.label}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
