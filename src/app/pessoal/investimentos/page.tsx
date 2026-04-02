'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda, MESES } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function PessoalInvestimentosPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dados, setDados] = useState<any>(null)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
    const res = await fetch(`/api/v2/pessoal/investimentos?ano=${ano}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setDados(await res.json())
    setLoading(false)
  }, [token, ano])

  useEffect(() => { carregar() }, [carregar])

  async function importarExtrato(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setErro('')
    setSucesso('')
    setImportando(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/v2/pessoal/investimentos/importar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setSucesso(`${data.investimento.produto} atualizado com sucesso!`)
      carregar()
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setImportando(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const graficoDados = dados?.porMes
    ? Array.from({ length: 12 }, (_, i) => ({
        mes: MESES[i + 1].slice(0, 3),
        Aplicado: dados.porMes[i + 1]?.aplicado || 0,
        Resgatado: dados.porMes[i + 1]?.resgatado || 0,
      })).filter((d) => d.Aplicado > 0 || d.Resgatado > 0)
    : []

  const totalCarteira = dados?.posicoes?.reduce((s: number, p: any) => s + Number(p.saldoAtual), 0) || 0
  const totalRendimentos = dados?.posicoes?.reduce((s: number, p: any) => s + Number(p.rendimentosProvisionados), 0) || 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Investimentos</h1>
          <p className="text-sm text-gray-500">Posições e movimentações</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importando}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {importando ? '...' : '📄 Importar Extrato'}
          </button>
          <select value={ano} onChange={(e) => setAno(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={importarExtrato} />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{erro}</div>}
        {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{sucesso}</div>}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : (
          <>
            {/* Carteira atual */}
            {dados?.posicoes?.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Carteira Atual</h2>
                <div className="grid md:grid-cols-2 gap-3 mb-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="text-xs text-blue-600 font-semibold mb-1">Saldo Total Investido</div>
                    <div className="text-2xl font-bold text-blue-700">{formatarMoeda(totalCarteira)}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="text-xs text-green-600 font-semibold mb-1">Rendimentos Provisionados</div>
                    <div className="text-2xl font-bold text-green-700">{formatarMoeda(totalRendimentos)}</div>
                  </div>
                </div>

                {dados.posicoes.map((p: any) => {
                  const rentPct = p.valorInicial > 0 ? ((Number(p.rendimentosProvisionados) / Number(p.valorInicial)) * 100) : 0
                  const venc = p.vencimento ? new Date(p.vencimento) : null
                  const diasVenc = venc ? Math.ceil((venc.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
                  return (
                    <div key={p.id} className="bg-white rounded-xl p-5 shadow-sm border">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-gray-900">{p.produto}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {p.remuneracao} {p.indexador && `· ${p.indexador}`}
                            {p.titulo && ` · Título: ${p.titulo}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">{formatarMoeda(Number(p.saldoAtual))}</div>
                          <div className="text-xs text-gray-400">Líquido: {formatarMoeda(Number(p.liquidoSaque))}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <div className="text-gray-400">Aplicação inicial</div>
                          <div className="font-medium text-gray-700">{formatarMoeda(Number(p.valorInicial))}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Rendimento</div>
                          <div className={`font-medium ${rentPct > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {formatarMoeda(Number(p.rendimentosProvisionados))} ({rentPct.toFixed(2)}%)
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">Vencimento</div>
                          <div className={`font-medium ${diasVenc !== null && diasVenc < 90 ? 'text-orange-500' : 'text-gray-700'}`}>
                            {venc ? venc.toLocaleDateString('pt-BR') : '—'}
                            {diasVenc !== null && diasVenc > 0 && <span className="ml-1 text-gray-400">({diasVenc}d)</span>}
                          </div>
                        </div>
                      </div>
                      {p.tributacao && (
                        <div className="text-xs text-gray-400 mt-2">{p.tributacao}</div>
                      )}
                      <div className="text-xs text-gray-300 mt-1">
                        Atualizado em {new Date(p.atualizadoEm).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* KPIs do ano */}
            {(dados?.totalAplicadoAno > 0 || dados?.totalResgatadoAno > 0) && (
              <>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Movimentações {ano}</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl p-5 shadow-sm border">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Aplicado</div>
                    <div className="text-lg font-bold text-blue-600">{formatarMoeda(dados.totalAplicadoAno)}</div>
                  </div>
                  <div className="bg-white rounded-xl p-5 shadow-sm border">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resgatado</div>
                    <div className="text-lg font-bold text-orange-500">{formatarMoeda(dados.totalResgatadoAno)}</div>
                  </div>
                  <div className="bg-white rounded-xl p-5 shadow-sm border">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Líquido saiu</div>
                    <div className="text-lg font-bold text-gray-700">{formatarMoeda(Math.abs(dados.saldoLiquidoAno))}</div>
                  </div>
                </div>

                {graficoDados.length > 0 && (
                  <div className="bg-white rounded-xl p-5 shadow-sm border">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Mês a mês — {ano}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={graficoDados} barCategoryGap="30%">
                        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any) => formatarMoeda(v)} />
                        <Legend />
                        <Bar dataKey="Aplicado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Resgatado" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <h3 className="text-sm font-semibold text-gray-700">Movimentos {ano}</h3>
                  </div>
                  <div className="divide-y max-h-72 overflow-auto">
                    {dados.movimentos.map((m: any, i: number) => (
                      <div key={i} className="px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.tipo === 'aplicacao' ? 'bg-blue-500' : 'bg-orange-400'}`} />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{m.descricao || (m.tipo === 'aplicacao' ? 'Aplicação' : 'Resgate')}</div>
                            <div className="text-xs text-gray-400">{new Date(m.data).toLocaleDateString('pt-BR')}</div>
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${m.tipo === 'aplicacao' ? 'text-blue-600' : 'text-orange-500'}`}>
                          {m.tipo === 'aplicacao' ? '-' : '+'}{formatarMoeda(m.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!dados?.posicoes?.length && !dados?.totalAplicadoAno && !dados?.totalResgatadoAno && (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm border">
                <div className="text-4xl mb-4">📈</div>
                <h2 className="text-lg font-semibold text-gray-800">Nenhum investimento registrado</h2>
                <p className="text-gray-500 mt-2 text-sm">
                  Importe o extrato do produto de investimento (PDF do Sicredi) para ver sua carteira,<br />
                  ou importe o extrato bancário com movimentos de aplicação/resgate.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
