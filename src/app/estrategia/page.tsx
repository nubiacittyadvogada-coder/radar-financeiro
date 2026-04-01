'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda } from '@/lib/utils'

export default function EstrategiaPage() {
  const router = useRouter()
  const [estrategia, setEstrategia] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [usuario, setUsuario] = useState<any>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    setUsuario(JSON.parse(u))
  }, [router])

  async function gerarEstrategia() {
    setLoading(true)
    setErro('')
    try {
      const data = await api.gerarEstrategia()
      setEstrategia(data)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700 text-sm">← Voltar</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Estratégia Financeira</h1>
            <p className="text-sm text-gray-500">Análise completa com IA baseada nos seus dados reais</p>
          </div>
        </div>
        <button
          onClick={gerarEstrategia}
          disabled={loading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <><span className="animate-spin">⟳</span> Analisando...</>
          ) : (
            <>{estrategia ? '↺ Atualizar Análise' : '✦ Gerar Estratégia'}</>
          )}
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {!estrategia && !loading && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="text-5xl mb-4">✦</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Pronta para sua análise estratégica?</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              A IA vai analisar todos os seus dados financeiros reais e gerar um plano completo: o que cortar, como crescer e o que fazer nos próximos 90 dias.
            </p>
            <button
              onClick={gerarEstrategia}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700"
            >
              Gerar Estratégia Agora
            </button>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="text-4xl animate-pulse mb-4">⟳</div>
            <p className="text-gray-600 font-medium">Analisando seus dados financeiros...</p>
            <p className="text-gray-400 text-sm mt-2">Isso pode levar até 30 segundos</p>
          </div>
        )}

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {erro.includes('ANTHROPIC_API_KEY') || erro.includes('api_key')
              ? 'Configure a ANTHROPIC_API_KEY no arquivo .env para usar a IA.'
              : erro}
          </div>
        )}

        {estrategia && (
          <div className="space-y-6">
            {/* Diagnóstico */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-blue-600">◉</span> Diagnóstico da sua empresa
              </h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{estrategia.diagnostico}</p>
            </div>

            {/* Pontos críticos */}
            {estrategia.pontosCriticos?.length > 0 && (
              <div className="bg-red-50 rounded-xl border border-red-100 p-6">
                <h2 className="text-lg font-bold text-red-800 mb-3 flex items-center gap-2">
                  <span>⚠</span> Pontos Críticos
                </h2>
                <ul className="space-y-2">
                  {estrategia.pontosCriticos.map((p: string, i: number) => (
                    <li key={i} className="flex gap-3 text-red-700">
                      <span className="font-bold mt-0.5">{i + 1}.</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Despesas para cortar */}
              {estrategia.despesasParaCortar?.length > 0 && (
                <div className="bg-white rounded-xl border p-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-red-500">↓</span> Onde Reduzir Custos
                  </h2>
                  <div className="space-y-4">
                    {estrategia.despesasParaCortar.map((d: any, i: number) => (
                      <div key={i} className="border-l-4 border-red-300 pl-4">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-gray-800">{d.categoria}</span>
                          <span className="text-sm text-red-600 font-medium">
                            Economia: {typeof d.economia === 'number' ? formatarMoeda(d.economia) : d.economia}/mês
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{d.acao}</p>
                        {d.valorMensal > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">Gasto atual: {formatarMoeda(d.valorMensal)}/mês</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta retirada */}
              {estrategia.metaRetirada && (
                <div className="bg-blue-50 rounded-xl border border-blue-100 p-6">
                  <h2 className="text-lg font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <span>💰</span> Sua Retirada Ideal
                  </h2>
                  <div className="text-3xl font-bold text-blue-700 mb-2">
                    {formatarMoeda(estrategia.metaRetirada.valorIdeal)}/mês
                  </div>
                  <p className="text-blue-700 text-sm">{estrategia.metaRetirada.justificativa}</p>
                </div>
              )}
            </div>

            {/* Estratégias de receita */}
            {estrategia.estrategiasReceita?.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-green-600">↑</span> Como Crescer sua Receita
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {estrategia.estrategiasReceita.map((e: any, i: number) => (
                    <div key={i} className="bg-green-50 rounded-lg p-4 border border-green-100">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-green-800">{e.titulo}</span>
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                          {e.impactoPotencial}
                        </span>
                      </div>
                      <p className="text-sm text-green-700">{e.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Plano 90 dias */}
            {estrategia.planoAcao90dias?.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-purple-600">▶</span> Plano de Ação — Próximos 90 dias
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {estrategia.planoAcao90dias.map((p: any, i: number) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="font-bold text-gray-700 mb-3 text-center py-1 bg-gray-50 rounded">
                        {p.mes}
                      </div>
                      <ul className="space-y-2">
                        {p.acoes?.map((a: string, j: number) => (
                          <li key={j} className="flex gap-2 text-sm text-gray-600">
                            <span className="text-purple-500 mt-0.5 flex-shrink-0">•</span>
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alertas urgentes */}
            {estrategia.alertas?.length > 0 && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
                <h2 className="text-lg font-bold text-amber-800 mb-3 flex items-center gap-2">
                  <span>🔔</span> Alertas Urgentes
                </h2>
                <ul className="space-y-2">
                  {estrategia.alertas.map((a: string, i: number) => (
                    <li key={i} className="flex gap-2 text-amber-700">
                      <span className="font-bold">!</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mensagem motivacional */}
            {estrategia.mensagemMotivacional && (
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white text-center">
                <p className="text-lg font-medium italic">"{estrategia.mensagemMotivacional}"</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
