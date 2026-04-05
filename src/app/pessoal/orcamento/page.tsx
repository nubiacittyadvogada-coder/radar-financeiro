'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda, MESES } from '@/lib/utils'

const TITULAR_LABEL: Record<string, string> = {
  nubia: '👩 Nubia',
  matheus: '👨 Matheus',
}
const TITULAR_COR: Record<string, string> = {
  nubia: 'bg-rose-100 text-rose-700',
  matheus: 'bg-blue-100 text-blue-700',
}

export default function PessoalOrcamentoPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [orcamentos, setOrcamentos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ categoriaId: '', valorMeta: '', titular: '' })
  const [filtrando, setFiltrando] = useState<'todos' | 'nubia' | 'matheus'>('todos')

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregarCategorias(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await fetch(`/api/v2/pessoal/orcamento?mes=${mes}&ano=${ano}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setOrcamentos(await res.json())
    setLoading(false)
  }, [token, mes, ano])

  useEffect(() => { carregar() }, [carregar])

  async function carregarCategorias(t: string) {
    const res = await fetch('/api/v2/pessoal/categorias', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setCategorias(await res.json())
  }

  async function salvarOrcamento() {
    if (!token || !form.categoriaId || !form.valorMeta) return
    const res = await fetch('/api/v2/pessoal/orcamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        categoriaId: form.categoriaId,
        mes, ano,
        valorMeta: Number(form.valorMeta),
        titular: form.titular || null,
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ categoriaId: '', valorMeta: '', titular: '' })
      carregar()
    }
  }

  async function remover(id: string) {
    if (!token) return
    await fetch(`/api/v2/pessoal/orcamento?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    carregar()
  }

  const visíveis = orcamentos.filter((o) =>
    filtrando === 'todos' ? true :
    filtrando === 'nubia' ? (!o.titular || o.titular === 'nubia') :
    o.titular === 'matheus'
  )

  const totalMeta = visíveis.reduce((s, o) => s + Number(o.valorMeta), 0)
  const totalGasto = visíveis.reduce((s, o) => s + (o.valorGastoReal || 0), 0)

  // Alertas: categorias que passaram de 70%
  const alertas = orcamentos.filter((o) => {
    const pct = Number(o.valorMeta) > 0 ? (o.valorGastoReal / Number(o.valorMeta)) * 100 : 0
    return pct >= 70
  })

  const catSemOrcamento = categorias.filter(
    (c) => c.tipo === 'despesa' && !orcamentos.find((o) => o.categoriaId === c.id)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900">Orçamento</h1>
            <p className="text-xs text-gray-500">Meta: {formatarMoeda(totalMeta)} · Gasto: {formatarMoeda(totalGasto)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={`${mes}-${ano}`}
              onChange={(e) => { const [m, a] = e.target.value.split('-'); setMes(+m); setAno(+a) }}
              className="px-2 py-1.5 border rounded-lg text-sm"
            >
              {[new Date().getFullYear(), new Date().getFullYear() - 1].flatMap((a) =>
                Array.from({ length: 12 }, (_, i) => (
                  <option key={`${i+1}-${a}`} value={`${i + 1}-${a}`}>{MESES[i + 1]} {a}</option>
                ))
              )}
            </select>
            <button onClick={() => setShowForm(true)}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              + Meta
            </button>
          </div>
        </div>

        {/* Filtro titular */}
        {orcamentos.some(o => o.titular === 'matheus') && (
          <div className="flex gap-2 mt-3">
            {(['todos', 'nubia', 'matheus'] as const).map((f) => (
              <button key={f} onClick={() => setFiltrando(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  filtrando === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                {f === 'todos' ? 'Todos' : f === 'nubia' ? '👩 Nubia' : '👨 Matheus'}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-4 space-y-2">
          {alertas.map((o) => {
            const pct = Number(o.valorMeta) > 0 ? (o.valorGastoReal / Number(o.valorMeta)) * 100 : 0
            const estourou = pct >= 100
            return (
              <div key={o.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                estourou ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'
              }`}>
                <span className="text-lg">{estourou ? '🔴' : '🟡'}</span>
                <div className="flex-1">
                  <strong>{o.categoria?.nome}</strong>
                  {estourou
                    ? ` — limite estourado! Gastou ${formatarMoeda(o.valorGastoReal)} de ${formatarMoeda(Number(o.valorMeta))}`
                    : ` — ${pct.toFixed(0)}% do limite usado (${formatarMoeda(o.valorGastoReal)} de ${formatarMoeda(Number(o.valorMeta))})`
                  }
                </div>
                {o.titular && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TITULAR_COR[o.titular] || ''}`}>
                    {TITULAR_LABEL[o.titular]}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Resumo */}
        {visíveis.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Meta total', value: totalMeta, color: 'text-gray-800' },
              { label: 'Gasto', value: totalGasto, color: 'text-gray-800' },
              { label: 'Disponível', value: totalMeta - totalGasto, color: totalMeta - totalGasto >= 0 ? 'text-green-600' : 'text-red-500' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-xl p-3 shadow-sm border text-center">
                <div className="text-xs text-gray-500 mb-1">{k.label}</div>
                <div className={`text-base font-bold ${k.color}`}>{formatarMoeda(k.value)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h2 className="font-bold mb-4 text-gray-900">Definir limite de orçamento</h2>
              <div className="space-y-3">
                <select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Categoria *</option>
                  {catSemOrcamento.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <input type="number" placeholder="Limite mensal (R$) *"
                  value={form.valorMeta}
                  onChange={(e) => setForm({ ...form, valorMeta: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Titular do gasto</label>
                  <div className="flex gap-2">
                    {[
                      { value: '', label: '🏠 Compartilhado' },
                      { value: 'nubia', label: '👩 Nubia' },
                      { value: 'matheus', label: '👨 Matheus' },
                    ].map((opt) => (
                      <button key={opt.value} type="button"
                        onClick={() => setForm({ ...form, titular: opt.value })}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${
                          form.titular === opt.value
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
                <button onClick={salvarOrcamento} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Salvar</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : visíveis.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-500 mb-4">Nenhuma meta para {MESES[mes]}/{ano}.</p>
            <button onClick={() => setShowForm(true)} className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium">
              Definir limites
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {visíveis.map((o) => {
              const gasto = o.valorGastoReal || 0
              const gastoN = o.gastoNubia || 0
              const gastoM = o.gastoMatheus || 0
              const meta = Number(o.valorMeta)
              const pct = meta > 0 ? Math.min(100, (gasto / meta) * 100) : 0
              const estourou = pct >= 100
              const quaseEstourou = pct >= 70 && pct < 100

              return (
                <div key={o.id} className={`bg-white rounded-xl p-4 shadow-sm border ${
                  estourou ? 'border-red-200' : quaseEstourou ? 'border-amber-200' : ''
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{o.categoria?.nome}</span>
                      {o.titular && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TITULAR_COR[o.titular] || 'bg-gray-100 text-gray-600'}`}>
                          {TITULAR_LABEL[o.titular]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        estourou ? 'bg-red-100 text-red-700' :
                        quaseEstourou ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {pct.toFixed(0)}% {estourou ? '🔴' : quaseEstourou ? '🟡' : '🟢'}
                      </span>
                      <button onClick={() => remover(o.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>

                  {/* Barra principal */}
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${estourou ? 'bg-red-500' : quaseEstourou ? 'bg-amber-400' : 'bg-green-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Gasto: <strong className={estourou ? 'text-red-500' : 'text-gray-700'}>{formatarMoeda(gasto)}</strong></span>
                    <span>Limite: <strong>{formatarMoeda(meta)}</strong></span>
                    <span>Livre: <strong className={estourou ? 'text-red-500' : 'text-green-600'}>{formatarMoeda(meta - gasto)}</strong></span>
                  </div>

                  {/* Por titular (se houver ambos) */}
                  {gastoM > 0 && (
                    <div className="flex gap-2 mt-1">
                      <div className="flex-1 flex items-center gap-1.5 bg-rose-50 rounded-lg px-2 py-1">
                        <span className="text-xs text-rose-600 font-semibold">👩 Nubia</span>
                        <span className="text-xs text-rose-700 font-bold ml-auto">{formatarMoeda(gastoN)}</span>
                      </div>
                      <div className="flex-1 flex items-center gap-1.5 bg-blue-50 rounded-lg px-2 py-1">
                        <span className="text-xs text-blue-600 font-semibold">👨 Matheus</span>
                        <span className="text-xs text-blue-700 font-bold ml-auto">{formatarMoeda(gastoM)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
