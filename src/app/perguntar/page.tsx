'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { MESES } from '@/lib/utils'

const PERGUNTAS_RAPIDAS = [
  'Por que meu lucro caiu esse mês?',
  'Qual minha despesa que mais cresceu?',
  'Estou retirando mais do que o negócio suporta?',
  'O que eu preciso faturar para ter lucro?',
]

export default function PerguntarPage() {
  const router = useRouter()
  const [pergunta, setPergunta] = useState('')
  const [resposta, setResposta] = useState('')
  const [historico, setHistorico] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    api.getHistoricoIA().then(setHistorico).catch(() => {})
  }, [router])

  async function enviarPergunta(p?: string) {
    const txt = p || pergunta
    if (!txt.trim()) return
    setLoading(true)
    setResposta('')
    try {
      const data = await api.perguntar(txt, mes, ano)
      setResposta(data.resposta)
      setPergunta('')
      const hist = await api.getHistoricoIA()
      setHistorico(hist)
    } catch (err: any) {
      setResposta('Erro: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700">&larr; Voltar</button>
          <h1 className="text-xl font-bold">Pergunte sobre seus números</h1>
        </div>
        <select
          value={`${mes}-${ano}`}
          onChange={(e) => { const [m, a] = e.target.value.split('-'); setMes(+m); setAno(+a) }}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={`${i + 1}-${ano}`}>{MESES[i + 1]} {ano}</option>
          ))}
        </select>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Campo de pergunta */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <textarea
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="O que você quer saber sobre seus números?"
            className="w-full h-24 px-4 py-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarPergunta() } }}
          />
          <div className="flex justify-between items-center mt-4">
            <div className="flex flex-wrap gap-2">
              {PERGUNTAS_RAPIDAS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setPergunta(p); enviarPergunta(p) }}
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition"
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => enviarPergunta()}
              disabled={loading || !pergunta.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Pensando...' : 'Perguntar'}
            </button>
          </div>
        </div>

        {/* Resposta */}
        {resposta && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-blue-200">
            <p className="text-sm text-blue-600 font-medium mb-2">Resposta</p>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{resposta}</p>
          </div>
        )}

        {/* Histórico */}
        {historico.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Últimas perguntas</h2>
            <div className="space-y-3">
              {historico.map((c: any) => (
                <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border">
                  <p className="font-medium text-gray-900 text-sm">{c.pergunta}</p>
                  <p className="text-gray-600 text-sm mt-2">{c.resposta}</p>
                  <p className="text-gray-400 text-xs mt-2">
                    {new Date(c.criadoEm).toLocaleDateString('pt-BR')} — {c.contextoMes && `${MESES[c.contextoMes]}/${c.contextoAno}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
