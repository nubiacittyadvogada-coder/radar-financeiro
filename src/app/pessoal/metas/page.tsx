'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

type Meta = {
  id: string
  titulo: string
  descricao?: string
  valorMeta: number
  valorAtual: number
  prazo?: string
  status: string
  estrategiaIA?: string
  estrategiaGerada: boolean
}

export default function PessoalMetasPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [metaAberta, setMetaAberta] = useState<string | null>(null)
  const [estrategia, setEstrategia] = useState<Record<string, any>>({})
  const [gerandoIA, setGerandoIA] = useState<string | null>(null)
  const [form, setForm] = useState({ titulo: '', descricao: '', valorMeta: '', valorAtual: '0', prazo: '' })

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregar(t)
  }, [router])

  async function carregar(t: string) {
    setLoading(true)
    const res = await fetch('/api/v2/pessoal/metas', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) {
      const data: Meta[] = await res.json()
      setMetas(data)
      // Carrega estratégias já geradas
      const est: Record<string, any> = {}
      for (const m of data) {
        if (m.estrategiaIA) {
          try { est[m.id] = JSON.parse(m.estrategiaIA) } catch {}
        }
      }
      setEstrategia(est)
    }
    setLoading(false)
  }

  async function criarMeta() {
    if (!token || !form.titulo || !form.valorMeta) return
    const res = await fetch('/api/v2/pessoal/metas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        titulo: form.titulo,
        descricao: form.descricao || null,
        valorMeta: Number(form.valorMeta),
        valorAtual: Number(form.valorAtual),
        prazo: form.prazo || null,
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ titulo: '', descricao: '', valorMeta: '', valorAtual: '0', prazo: '' })
      carregar(token)
    }
  }

  async function atualizarValorAtual(id: string, novoValor: number) {
    if (!token) return
    await fetch(`/api/v2/pessoal/metas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ valorAtual: novoValor }),
    })
    carregar(token)
  }

  async function gerarEstrategia(id: string) {
    if (!token) return
    setGerandoIA(id)
    try {
      const res = await fetch(`/api/v2/pessoal/metas/${id}/estrategia`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setEstrategia((prev) => ({ ...prev, [id]: data.estrategia }))
        setMetaAberta(id)
      }
    } catch {}
    setGerandoIA(null)
  }

  async function deletar(id: string) {
    if (!token) return
    await fetch(`/api/v2/pessoal/metas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    carregar(token)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Metas Financeiras</h1>
          <p className="text-sm text-gray-500">{metas.filter((m) => m.status === 'ativa').length} ativa(s)</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          + Nova meta
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Form */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="font-bold mb-4">Nova meta</h2>
              <div className="space-y-3">
                <input placeholder="Título *" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input placeholder="Descrição (opcional)" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Valor total *</label>
                    <input type="number" placeholder="R$" value={form.valorMeta} onChange={(e) => setForm({ ...form, valorMeta: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Já guardado</label>
                    <input type="number" placeholder="R$" value={form.valorAtual} onChange={(e) => setForm({ ...form, valorAtual: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Prazo (opcional)</label>
                  <input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
                <button onClick={criarMeta} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Criar</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : metas.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-gray-500 mb-4">Nenhuma meta criada ainda.</p>
            <button onClick={() => setShowForm(true)} className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium">Criar primeira meta</button>
          </div>
        ) : (
          <div className="space-y-4">
            {metas.map((m) => {
              const pct = Number(m.valorMeta) > 0 ? Math.min(100, (Number(m.valorAtual) / Number(m.valorMeta)) * 100) : 0
              const concluida = pct >= 100
              const est = estrategia[m.id]
              const aberta = metaAberta === m.id

              return (
                <div key={m.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${concluida ? 'border-green-300' : ''}`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{m.titulo}</span>
                          {concluida && <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Concluída!</span>}
                        </div>
                        {m.descricao && <p className="text-xs text-gray-500 mt-0.5">{m.descricao}</p>}
                        {m.prazo && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Prazo: {new Date(m.prazo).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <button onClick={() => deletar(m.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>

                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${concluida ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-gray-500">
                        <strong className="text-gray-800">{formatarMoeda(m.valorAtual)}</strong> guardado
                      </span>
                      <span className="text-gray-500">
                        Meta: <strong className="text-gray-800">{formatarMoeda(m.valorMeta)}</strong>
                      </span>
                      <span className={`font-semibold ${concluida ? 'text-green-600' : 'text-blue-600'}`}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>

                    {/* Atualizar progresso */}
                    <div className="flex gap-2 items-center text-sm">
                      <input
                        type="number"
                        placeholder="Atualizar valor guardado"
                        className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            atualizarValorAtual(m.id, Number((e.target as HTMLInputElement).value));
                            (e.target as HTMLInputElement).value = ''
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (!est) gerarEstrategia(m.id)
                          else setMetaAberta(aberta ? null : m.id)
                        }}
                        disabled={gerandoIA === m.id}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
                      >
                        {gerandoIA === m.id ? 'Analisando...' : est ? (aberta ? 'Ocultar estratégia' : '🎯 Ver estratégia') : '✨ Gerar estratégia IA'}
                      </button>
                    </div>

                    {/* Estratégia IA */}
                    {aberta && est && (
                      <div className="mt-4 p-4 bg-purple-50 rounded-xl space-y-3">
                        <p className="text-sm font-medium text-purple-800">{est.resumo}</p>

                        <div className="flex gap-4 text-xs text-purple-700">
                          <span>💰 {formatarMoeda(est.por_mes_necessario)}/mês</span>
                          <span>⏱ {est.tempo_estimado}</span>
                          {est.possivel === false && <span className="text-red-500 font-medium">⚠️ Meta difícil no prazo</span>}
                        </div>

                        <div className="space-y-2">
                          {est.passos?.map((p: any, i: number) => (
                            <div key={i} className="flex gap-2 text-sm">
                              <span className="text-purple-400 font-bold flex-shrink-0">{i + 1}.</span>
                              <div>
                                <strong className="text-gray-800">{p.titulo}</strong>
                                <p className="text-gray-600 text-xs mt-0.5">{p.descricao}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {est.alertas?.length > 0 && (
                          <div className="bg-yellow-50 rounded-lg p-3">
                            {est.alertas.map((a: string, i: number) => (
                              <p key={i} className="text-xs text-yellow-700">⚠️ {a}</p>
                            ))}
                          </div>
                        )}

                        {est.dica_extra && (
                          <p className="text-xs text-purple-700 italic">💡 {est.dica_extra}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
