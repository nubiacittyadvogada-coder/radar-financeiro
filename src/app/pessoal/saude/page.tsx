'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

function ScoreCircle({ score }: { score: number }) {
  const cor = score >= 80 ? '#16a34a' : score >= 60 ? '#2563eb' : score >= 40 ? '#d97706' : '#dc2626'
  const grau = score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 40 ? 'Regular' : 'Atenção'
  const circunf = 2 * Math.PI * 54
  const offset = circunf * (1 - score / 100)

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#f3f4f6" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={cor} strokeWidth="10"
            strokeDasharray={circunf}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <div className="mt-2 text-base font-semibold" style={{ color: cor }}>{grau}</div>
    </div>
  )
}

function Indicador({
  label, valor, meta, pct, max, cor, detalhe,
}: {
  label: string; valor: string; meta: string; pct: number; max: number; cor: string; detalhe?: string
}) {
  const largura = Math.min(100, (pct / max) * 100)
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
          {detalhe && <div className="text-xs text-gray-400 mt-0.5">{detalhe}</div>}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">{valor}</div>
          <div className="text-xs text-gray-400">meta: {meta}</div>
        </div>
      </div>
      <div className="mt-3 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${largura}%`, backgroundColor: cor }} />
      </div>
    </div>
  )
}

function Regra502030({
  regra, mediaReceitas,
}: {
  regra: { necessidades: any; desejos: any; poupanca: any }; mediaReceitas: number
}) {
  const itens = [
    { label: 'Necessidades', sub: 'Moradia · Alimentação · Saúde · Transporte · Educação · Assinaturas', ...regra.necessidades, cor: '#3b82f6' },
    { label: 'Desejos', sub: 'Lazer · Vestuário · Outros', ...regra.desejos, cor: '#f59e0b' },
    { label: 'Poupança', sub: 'O que sobrou da renda (caixa)', ...regra.poupanca, cor: '#10b981' },
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-5 py-4 border-b">
        <h3 className="text-sm font-semibold text-gray-700">Regra 50/30/20</h3>
        <p className="text-xs text-gray-400 mt-0.5">% da renda mensal — baseado nos últimos meses</p>
      </div>
      <div className="px-5 py-4 space-y-5">
        {itens.map((item) => {
          const pctAtual = Math.max(0, item.pct)
          const desvio = pctAtual - item.ideal
          const status = Math.abs(desvio) <= 5 ? 'ok' : desvio > 0 ? 'acima' : 'abaixo'
          return (
            <div key={item.label}>
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                  <span className="text-xs text-gray-400 ml-2">ideal: {item.ideal}%</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">{pctAtual.toFixed(0)}%</span>
                  <span className="text-xs ml-1.5 px-1.5 py-0.5 rounded-full font-medium" style={{
                    backgroundColor: status === 'ok' ? '#dcfce7' : status === 'acima' ? '#fef3c7' : '#eff6ff',
                    color: status === 'ok' ? '#16a34a' : status === 'acima' ? '#b45309' : '#1d4ed8',
                  }}>
                    {status === 'ok' ? '✓ ok' : status === 'acima' ? `+${desvio.toFixed(0)}%` : `${desvio.toFixed(0)}%`}
                  </span>
                </div>
              </div>
              {/* Barra dupla: atual vs ideal */}
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="absolute h-full rounded-full opacity-30" style={{ width: `${item.ideal}%`, backgroundColor: item.cor }} />
                <div className="absolute h-full rounded-full" style={{ width: `${Math.min(pctAtual, 100)}%`, backgroundColor: item.cor }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-400">{item.sub}</span>
                <span className="text-xs font-medium text-gray-600">{formatarMoeda(item.valor)}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-5 py-3 bg-gray-50 border-t">
        <p className="text-xs text-gray-400">
          A barra mais clara indica o ideal. A mais escura é o seu gasto atual.
        </p>
      </div>
    </div>
  )
}

const MESES_NOMES: Record<number, string> = {
  1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
  7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
}

export default function SaudePage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [dados, setDados] = useState<any>(null)
  const [recorrentes, setRecorrentes] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
    const h = { Authorization: `Bearer ${token}` }
    const [res1, res2] = await Promise.all([
      fetch('/api/v2/pessoal/saude', { headers: h }),
      fetch('/api/v2/pessoal/recorrentes', { headers: h }),
    ])
    if (res1.ok) setDados(await res1.json())
    if (res2.ok) setRecorrentes(await res2.json())
    setLoading(false)
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  const poupancaCor = (v: number) => v >= 20 ? '#16a34a' : v >= 10 ? '#2563eb' : v >= 5 ? '#d97706' : '#dc2626'
  const cartaoCor = (v: number) => v <= 20 ? '#16a34a' : v <= 30 ? '#2563eb' : v <= 40 ? '#d97706' : '#dc2626'
  const reservaCor = (v: number) => v >= 6 ? '#16a34a' : v >= 3 ? '#2563eb' : v >= 1 ? '#d97706' : '#dc2626'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Saúde Financeira</h1>
        <p className="text-sm text-gray-500">Diagnóstico baseado nos seus dados reais</p>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Calculando sua saúde financeira...</div>
        ) : !dados || dados.semDados ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border">
            <div className="text-4xl mb-4">📊</div>
            <h2 className="text-lg font-semibold text-gray-800">Sem dados suficientes</h2>
            <p className="text-gray-500 mt-2 text-sm">
              Importe ao menos 1 mês de extrato bancário para ver seu score.
            </p>
            <button
              onClick={() => router.push('/pessoal/transacoes')}
              className="mt-4 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Importar extrato
            </button>
          </div>
        ) : (
          <>
            {/* Score + resumo */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-5 py-5 flex flex-col md:flex-row items-center gap-6">
                <ScoreCircle score={dados.score} />
                <div className="flex-1 space-y-3 text-center md:text-left">
                  <p className="text-sm text-gray-500">
                    Análise baseada nos <strong>{dados.mesesAnalisados} meses</strong> mais recentes com dados
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs text-green-600 font-semibold">Receita média</div>
                      <div className="text-base font-bold text-green-700">{formatarMoeda(dados.mediaReceitas)}</div>
                      <div className="text-xs text-green-500">por mês</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <div className="text-xs text-red-600 font-semibold">Despesas médias</div>
                      <div className="text-base font-bold text-red-700">{formatarMoeda(dados.mediaDespesas)}</div>
                      <div className="text-xs text-red-500">extrato bancário</div>
                    </div>
                    {dados.temCartao ? (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-xs text-blue-600 font-semibold">Fatura média</div>
                        <div className="text-base font-bold text-blue-700">{formatarMoeda(dados.mediaCartao)}</div>
                        <div className="text-xs text-blue-500">cartão de crédito</div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 font-semibold">Saldo médio</div>
                        <div className="text-base font-bold text-gray-700">{formatarMoeda(dados.mediaReceitas - dados.mediaDespesas)}</div>
                        <div className="text-xs text-gray-400">por mês</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Barra de pontos */}
              <div className="border-t px-5 py-3 grid grid-cols-4 gap-2 bg-gray-50 text-xs text-center">
                {[
                  { label: 'Poupança', pts: dados.pontos.ptsPoupanca, max: 30 },
                  { label: '50/30/20', pts: dados.pontos.pts5020, max: 30 },
                  { label: 'Reserva', pts: dados.pontos.ptsReserva, max: 25 },
                  { label: 'Cartão', pts: dados.pontos.ptsCartao, max: 15 },
                ].map((p) => (
                  <div key={p.label}>
                    <div className="text-gray-500 mb-1">{p.label}</div>
                    <div className="font-bold text-gray-800">{p.pts}<span className="font-normal text-gray-400">/{p.max}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dicas */}
            {dados.dicas.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pontos de atenção</h2>
                {dados.dicas.map((d: any, i: number) => (
                  <div key={i} className={`rounded-xl p-4 flex gap-3 border ${
                    d.urgencia === 'alta' ? 'bg-red-50 border-red-200' :
                    d.urgencia === 'media' ? 'bg-amber-50 border-amber-200' :
                    'bg-green-50 border-green-200'
                  }`}>
                    <span className="text-xl flex-shrink-0">
                      {d.urgencia === 'alta' ? '🔴' : d.urgencia === 'media' ? '🟡' : '🟢'}
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${
                        d.urgencia === 'alta' ? 'text-red-700' : d.urgencia === 'media' ? 'text-amber-700' : 'text-green-700'
                      }`}>{d.titulo}</div>
                      <div className={`text-xs mt-0.5 ${
                        d.urgencia === 'alta' ? 'text-red-600' : d.urgencia === 'media' ? 'text-amber-600' : 'text-green-600'
                      }`}>{d.detalhe}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Indicadores */}
            <div className="grid md:grid-cols-2 gap-4">
              <Indicador
                label="Taxa de poupança"
                detalhe="(receitas − despesas) ÷ receitas"
                valor={`${dados.taxaPoupanca.toFixed(0)}%`}
                meta="≥ 20%"
                pct={Math.max(0, dados.taxaPoupanca)}
                max={30}
                cor={poupancaCor(dados.taxaPoupanca)}
              />
              <Indicador
                label="Reserva de emergência"
                detalhe={`${formatarMoeda(dados.reservaEmergencia.saldoInvestimentos)} em investimentos`}
                valor={`${dados.reservaEmergencia.meses.toFixed(1)} meses`}
                meta="6 meses"
                pct={Math.min(dados.reservaEmergencia.meses, 6)}
                max={6}
                cor={reservaCor(dados.reservaEmergencia.meses)}
              />
              {dados.temCartao && (
                <Indicador
                  label="Cartão vs renda"
                  detalhe={`${formatarMoeda(dados.mediaCartao)} de fatura média`}
                  valor={`${dados.cartaoPctReceita.toFixed(0)}%`}
                  meta="≤ 30%"
                  pct={Math.min(dados.cartaoPctReceita, 60)}
                  max={60}
                  cor={cartaoCor(dados.cartaoPctReceita)}
                />
              )}
              {dados.reservaEmergencia.faltaParaMeta > 0 && (
                <div className="bg-white rounded-xl p-5 shadow-sm border">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Meta de reserva</div>
                  <div className="text-xs text-gray-400 mb-3">quanto falta para ter 6 meses de reserva</div>
                  <div className="text-2xl font-bold text-orange-500">{formatarMoeda(dados.reservaEmergencia.faltaParaMeta)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    = {Math.ceil(dados.reservaEmergencia.faltaParaMeta / (dados.mediaReceitas * 0.1))} meses guardando 10% da renda
                  </div>
                </div>
              )}
            </div>

            {/* Regra 50/30/20 */}
            <Regra502030 regra={dados.regra502030} mediaReceitas={dados.mediaReceitas} />

            {/* Gastos recorrentes */}
            {recorrentes && recorrentes.recorrentes?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">🔁 Gastos recorrentes</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Despesas que aparecem todo mês no extrato</p>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-gray-800">{formatarMoeda(recorrentes.totalMensalRecorrentes)}</div>
                    <div className="text-xs text-gray-400">/mês em recorrentes</div>
                  </div>
                </div>
                {recorrentes.assinaturas?.length > 0 && (
                  <div className="px-5 py-3 bg-purple-50 border-b flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-700">📱 Assinaturas identificadas</span>
                    <span className="text-sm font-bold text-purple-700">{formatarMoeda(recorrentes.totalAssinaturas)}/mês</span>
                  </div>
                )}
                <div className="divide-y max-h-72 overflow-y-auto">
                  {recorrentes.recorrentes.map((r: any, i: number) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{r.descricao}</div>
                        <div className="text-xs text-gray-400 flex gap-2">
                          {r.categoria && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{r.categoria}</span>}
                          <span>presente em {r.mesesPresente} meses</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-700 flex-shrink-0">{formatarMoeda(r.valorMedio)}/mês</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projeção próximo mês */}
            {recorrentes?.projecao && recorrentes.projecao.totalProjetado > 0 && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">
                      🔮 Projeção — {MESES_NOMES[recorrentes.projecao.mes]} {recorrentes.projecao.ano}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Baseado na média dos últimos {recorrentes.projecao.baseadoEmMeses} meses
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Receita estimada</div>
                    <div className="text-base font-bold text-green-600">{formatarMoeda(recorrentes.projecao.mediaReceitas)}</div>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-2">
                  {recorrentes.projecao.porCategoria.slice(0, 10).map((c: any, i: number) => {
                    const pct = recorrentes.projecao.totalProjetado > 0 ? (c.valor / recorrentes.projecao.totalProjetado) * 100 : 0
                    return (
                      <div key={c.nome}>
                        <div className="flex justify-between text-sm mb-0.5">
                          <span className="text-gray-600 truncate max-w-[200px]">{c.nome}</span>
                          <span className="font-medium text-gray-800">{formatarMoeda(c.valor)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="px-5 py-3 bg-gray-50 border-t flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-gray-700">Total projetado</span>
                    <span className="text-xs text-gray-400 ml-2">(extrato + cartão)</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-gray-800">{formatarMoeda(recorrentes.projecao.totalProjetado)}</div>
                    <div className={`text-xs font-medium ${recorrentes.projecao.saldoEstimado >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      Saldo estimado: {recorrentes.projecao.saldoEstimado >= 0 ? '+' : ''}{formatarMoeda(recorrentes.projecao.saldoEstimado)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-center text-gray-400 pb-2">
              Score calculado com base nos últimos {dados.mesesAnalisados} meses · Atualiza automaticamente a cada novo extrato importado
            </p>
          </>
        )}
      </main>
    </div>
  )
}
