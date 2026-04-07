'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatarMoeda, formatarPercentual, MESES } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}

function KPI({ label, value, sub, color = 'gray' }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600', red: 'text-red-500', gray: 'text-gray-800'
  }
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${colors[color]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function EmpresaDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [usuario, setUsuario] = useState<any>(null)
  const [token, setToken] = useState<string | null>(null)
  const [fechamento, setFechamento] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [alertasContas, setAlertasContas] = useState<{ atrasadas: any[]; proximas: any[] }>({ atrasadas: [], proximas: [] })
  const [fechamentoAnterior, setFechamentoAnterior] = useState<any>(null)
  const [mes, setMes] = useState(() => Number(searchParams.get('mes') || new Date().getMonth() + 1))
  const [ano, setAno] = useState(() => Number(searchParams.get('ano') || new Date().getFullYear()))
  const [loading, setLoading] = useState(true)
  const [disparando, setDisparando] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setUsuario(parsed)
    setToken(t)
  }, [router])

  const carregarDados = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const h = { Authorization: `Bearer ${token}` }
    try {
      const anoAnterior = mes === 1 ? ano - 1 : ano
      const mesAnterior = mes === 1 ? 12 : mes - 1
      const [fechRes, histRes, contasRes, fechAntRes] = await Promise.all([
        fetch(`/api/v2/empresa/fechamento?mes=${mes}&ano=${ano}`, { headers: h }),
        fetch('/api/v2/empresa/historico?ultimos=6', { headers: h }),
        fetch('/api/v2/empresa/contas/alertas', { headers: h }),
        fetch(`/api/v2/empresa/fechamento?mes=${mesAnterior}&ano=${anoAnterior}`, { headers: h }),
      ])
      if (fechRes.ok) setFechamento(await fechRes.json())
      else setFechamento(null)
      if (histRes.ok) setHistorico(await histRes.json())
      if (contasRes.ok) setAlertasContas(await contasRes.json())
      if (fechAntRes.ok) setFechamentoAnterior(await fechAntRes.json())
      else setFechamentoAnterior(null)
    } catch {} finally { setLoading(false) }
  }, [token, mes, ano])

  useEffect(() => { carregarDados() }, [carregarDados])

  async function dispararResumo() {
    if (!token) return
    setDisparando(true)
    try {
      const res = await fetch('/api/cron/resumo-semanal', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      alert(`✅ Resumo enviado! ${data.empresasNotificadas} empresa(s) notificada(s).`)
    } catch (err: any) {
      alert('Erro ao disparar: ' + err.message)
    } finally {
      setDisparando(false)
    }
  }

  const f = fechamento
  const graficoHistorico = historico.map((h: any) => ({
    mes: `${MESES[h.mes]}/${String(h.ano).slice(2)}`,
    receita: Number(h.receitaBruta || 0),
    lucro: Number(h.lucroLiquido || 0),
  }))

  const totalAtrasadas = alertasContas.atrasadas.reduce((s: number, c: any) => s + Number(c.valor), 0)

  function varMes(atual: any, anterior: any, campo: string) {
    const a = Number(atual?.[campo] || 0)
    const ant = Number(anterior?.[campo] || 0)
    if (ant === 0) return null
    const pct = ((a - ant) / Math.abs(ant)) * 100
    return { pct, subiu: pct >= 0 }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard Empresa</h1>
          {usuario && <p className="text-sm text-gray-500">{usuario.nome}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={dispararResumo}
            disabled={disparando}
            title="Envia o resumo semanal agora via WhatsApp"
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {disparando ? '⏳' : '📲 Resumo agora'}
          </button>
        <select
          value={`${mes}-${ano}`}
          onChange={(e) => { const [m, a] = e.target.value.split('-'); setMes(+m); setAno(+a) }}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].flatMap((a) =>
            Array.from({ length: 12 }, (_, i) => (
              <option key={`${i+1}-${a}`} value={`${i + 1}-${a}`}>{MESES[i + 1]} {a}</option>
            ))
          )}
        </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : !f ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border">
            <div className="text-4xl mb-4">📂</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Nenhum dado para {MESES[mes]}/{ano}</h2>
            <p className="text-gray-500 mb-6">Importe sua planilha DRE para visualizar o resultado.</p>
            <button
              onClick={() => router.push('/empresa/importar')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Importar planilha
            </button>
          </div>
        ) : (
          <>
            {/* KPIs principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card title="Receita Bruta">
                <KPI label="Realizada" value={formatarMoeda(f.receitaBruta)} color="blue" />
                {Number(f.receitaPrevista) > 0 && (
                  <div className="text-xs text-purple-500 mt-1.5 font-medium">
                    + {formatarMoeda(f.receitaPrevista)} prevista
                  </div>
                )}
                {(() => { const v = varMes(f, fechamentoAnterior, 'receitaBruta'); return v ? <div className={`text-xs mt-1 font-medium ${v.subiu ? 'text-green-500' : 'text-red-400'}`}>{v.subiu ? '▲' : '▼'} {Math.abs(v.pct).toFixed(1)}% vs mês ant.</div> : null })()}
              </Card>
              <Card title="Receita Líquida">
                <KPI label="" value={formatarMoeda(f.receitaLiquida)} />
              </Card>
              <Card title="Lucro Operacional">
                <KPI
                  label=""
                  value={formatarMoeda(f.lucroOperacional)}
                  sub={formatarPercentual(f.percLucroOp)}
                  color={Number(f.lucroOperacional) >= 0 ? 'green' : 'red'}
                />
                {(() => { const v = varMes(f, fechamentoAnterior, 'lucroOperacional'); return v ? <div className={`text-xs mt-1 font-medium ${v.subiu ? 'text-green-500' : 'text-red-400'}`}>{v.subiu ? '▲' : '▼'} {Math.abs(v.pct).toFixed(1)}% vs mês ant.</div> : null })()}
              </Card>
              <Card title="Lucro Líquido">
                <KPI
                  label=""
                  value={formatarMoeda(f.lucroLiquido)}
                  sub={formatarPercentual(f.percLucroLiq)}
                  color={Number(f.lucroLiquido) >= 0 ? 'green' : 'red'}
                />
                {(() => { const v = varMes(f, fechamentoAnterior, 'lucroLiquido'); return v ? <div className={`text-xs mt-1 font-medium ${v.subiu ? 'text-green-500' : 'text-red-400'}`}>{v.subiu ? '▲' : '▼'} {Math.abs(v.pct).toFixed(1)}% vs mês ant.</div> : null })()}
              </Card>
            </div>

            {/* Provisionados */}
            {(Number(f.receitaPrevista) > 0 || Number(f.despesaPrevista) > 0) && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-4 flex flex-wrap gap-6">
                <div className="text-sm font-semibold text-purple-700 w-full mb-1">Provisionado (não pago ainda)</div>
                {Number(f.receitaPrevista) > 0 && (
                  <div>
                    <div className="text-xs text-purple-500">Receitas previstas</div>
                    <div className="text-lg font-bold text-purple-700">{formatarMoeda(f.receitaPrevista)}</div>
                    <div className="text-xs text-gray-400">a receber neste mês</div>
                  </div>
                )}
                {Number(f.despesaPrevista) > 0 && (
                  <div>
                    <div className="text-xs text-orange-500">Despesas previstas</div>
                    <div className="text-lg font-bold text-orange-600">{formatarMoeda(f.despesaPrevista)}</div>
                    <div className="text-xs text-gray-400">a pagar neste mês</div>
                  </div>
                )}
                {Number(f.receitaPrevista) > 0 && Number(f.despesaPrevista) > 0 && (
                  <div>
                    <div className="text-xs text-gray-500">Resultado previsto</div>
                    <div className={`text-lg font-bold ${Number(f.receitaPrevista) - Number(f.despesaPrevista) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatarMoeda(Number(f.receitaPrevista) - Number(f.despesaPrevista))}
                    </div>
                    <div className="text-xs text-gray-400">saldo projetado</div>
                  </div>
                )}
              </div>
            )}

            {/* DRE simplificado */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card title="Demonstrativo de Resultado">
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Receita Bruta', value: f.receitaBruta, bold: true },
                    { label: '(-) Repasse Êxito', value: -f.repasseExito },
                    { label: '(-) Impostos', value: -f.impostos },
                    { label: 'Receita Líquida', value: f.receitaLiquida, bold: true },
                    { label: '(-) Custos Diretos', value: -f.custosDiretos },
                    { label: 'Margem de Contribuição', value: f.margemContribuicao, bold: true, sub: formatarPercentual(f.percMargem) },
                    { label: '(-) Desp. Pessoal', value: -f.despesasPessoal },
                    { label: '(-) Desp. Marketing', value: -f.despesasMarketing },
                    { label: '(-) Desp. Gerais', value: -f.despesasGerais },
                    { label: 'Lucro Operacional', value: f.lucroOperacional, bold: true, sub: formatarPercentual(f.percLucroOp) },
                    { label: '(-) Retirada Sócios', value: -f.retiradaSocios },
                    { label: 'Res. Financeiro', value: f.resultadoFinanceiro },
                    { label: 'Lucro Líquido', value: f.lucroLiquido, bold: true, highlight: true, sub: formatarPercentual(f.percLucroLiq) },
                  ].map((row, i) => (
                    <div key={i} className={`flex justify-between ${row.bold ? 'font-semibold border-t pt-1.5' : ''} ${row.highlight ? 'bg-blue-50 px-2 py-1 rounded' : ''}`}>
                      <span className="text-gray-600">{row.label}</span>
                      <span className={`${Number(row.value) < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                        {formatarMoeda(row.value)}
                        {row.sub && <span className="text-xs text-gray-400 ml-1">({row.sub})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-4">
                {/* Alertas de contas */}
                {(alertasContas.atrasadas.length > 0 || alertasContas.proximas.length > 0) && (
                  <Card title="Alertas de Contas">
                    {alertasContas.atrasadas.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-red-600 mb-2">
                          {alertasContas.atrasadas.length} conta(s) atrasada(s) — {formatarMoeda(totalAtrasadas)}
                        </div>
                        {alertasContas.atrasadas.slice(0, 3).map((c: any) => (
                          <div key={c.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                            <span className="text-gray-700 truncate max-w-[150px]">{c.descricao}</span>
                            <span className="text-red-500 font-medium">{formatarMoeda(c.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {alertasContas.proximas.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-yellow-600 mb-2">Vencendo em 7 dias</div>
                        {alertasContas.proximas.slice(0, 3).map((c: any) => (
                          <div key={c.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                            <span className="text-gray-700 truncate max-w-[150px]">{c.descricao}</span>
                            <span className="text-yellow-600 font-medium">{formatarMoeda(c.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {/* Resultado de caixa */}
                <Card title="Resultado de Caixa">
                  <div className="space-y-2 text-sm">
                    {[
                      { label: 'Lucro Líquido', value: f.lucroLiquido },
                      { label: '(-) Distribuição', value: -f.distribuicaoLucros },
                      { label: '(-) Investimentos', value: -f.investimentos },
                      { label: 'Empréstimos entrada', value: f.emprestimosEntrada },
                      { label: '(-) Empréstimos pagto', value: -f.emprestimosPagamento },
                    ].map((row, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-gray-500">{row.label}</span>
                        <span className={Number(row.value) < 0 ? 'text-red-400' : 'text-gray-700'}>{formatarMoeda(row.value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>Resultado Caixa</span>
                      <span className={Number(f.resultadoCaixa) >= 0 ? 'text-green-600' : 'text-red-500'}>
                        {formatarMoeda(f.resultadoCaixa)}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Receita por área + por advogado */}
            {(f.resultadosPorSetor && Object.keys(f.resultadosPorSetor).length > 0) ||
             (f.resultadosPorAdvogado && Object.keys(f.resultadosPorAdvogado).length > 0) ? (
              <div className="grid md:grid-cols-2 gap-4">
                {f.resultadosPorSetor && Object.keys(f.resultadosPorSetor).length > 0 && (
                  <Card title="Receita por Área">
                    <div className="space-y-2">
                      {Object.entries(f.resultadosPorSetor as Record<string, { receita: number; custo: number }>)
                        .sort(([, a], [, b]) => b.receita - a.receita)
                        .map(([area, dados]) => {
                          const pct = Number(f.receitaBruta) > 0 ? (dados.receita / Number(f.receitaBruta)) * 100 : 0
                          return (
                            <div key={area}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700">{area}</span>
                                <span className="text-blue-600 font-medium">{formatarMoeda(dados.receita)}</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })
                      }
                    </div>
                  </Card>
                )}
                {f.resultadosPorAdvogado && Object.keys(f.resultadosPorAdvogado).length > 0 && (
                  <Card title="Receita por Advogado">
                    <div className="space-y-2">
                      {Object.entries(f.resultadosPorAdvogado as Record<string, { receita: number; qtd: number }>)
                        .sort(([, a], [, b]) => b.receita - a.receita)
                        .map(([adv, dados]) => {
                          const pct = Number(f.receitaBruta) > 0 ? (dados.receita / Number(f.receitaBruta)) * 100 : 0
                          return (
                            <div key={adv}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700">{adv}</span>
                                <span className="text-green-600 font-medium">{formatarMoeda(dados.receita)}<span className="text-xs text-gray-400 ml-1">({dados.qtd})</span></span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })
                      }
                    </div>
                  </Card>
                )}
              </div>
            ) : null}

            {/* Gráfico histórico */}
            {graficoHistorico.length > 1 && (
              <Card title="Evolução dos últimos meses">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={graficoHistorico}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => formatarMoeda(v)} />
                    <Line type="monotone" dataKey="receita" stroke="#3b82f6" name="Receita" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="lucro" stroke="#10b981" name="Lucro" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
