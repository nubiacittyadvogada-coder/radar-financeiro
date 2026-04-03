'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

type Conta = {
  id: string
  descricao: string
  fornecedor: string | null
  categoria: string | null
  tag: string | null
  valor: string
  vencimento: string | null
  status: string
  pagoEm: string | null
  observacoes: string | null
}

const DATA_CASAMENTO = new Date('2026-10-03T16:00:00')
const TOTAL_CASAMENTO = 146508.62
const TOTAL_PAGO_HISTORICO = 50584.62

function diasAte(data: Date) {
  const hoje = new Date()
  const diff = data.getTime() - hoje.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function mesesAte(data: Date) {
  const hoje = new Date()
  const anos = data.getFullYear() - hoje.getFullYear()
  const meses = data.getMonth() - hoje.getMonth()
  return anos * 12 + meses
}

const MESES_PT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_FULL = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function CasamentoPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [adicionando, setAdicionando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [nova, setNova] = useState({ descricao: '', fornecedor: '', valor: '', vencimento: '', observacoes: '' })

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
      const res = await fetch('/api/v2/pessoal/contas-pagar?tag=casamento', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setContas(await res.json())
    } catch {} finally { setLoading(false) }
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  async function marcarPago(id: string) {
    if (!token) return
    await fetch(`/api/v2/pessoal/contas-pagar/${id}/pagar`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    })
    carregar()
  }

  async function excluir(id: string) {
    if (!token || !confirm('Excluir esta conta?')) return
    await fetch(`/api/v2/pessoal/contas-pagar?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    carregar()
  }

  async function salvar() {
    if (!token || !nova.descricao || !nova.valor) return
    setSalvando(true)
    try {
      await fetch('/api/v2/pessoal/contas-pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...nova,
          tag: 'casamento',
          categoria: 'Casamento',
          valor: parseFloat(nova.valor.replace(',', '.')),
          vencimento: nova.vencimento || null,
        }),
      })
      setNova({ descricao: '', fornecedor: '', valor: '', vencimento: '', observacoes: '' })
      setAdicionando(false)
      carregar()
    } finally { setSalvando(false) }
  }

  // Cálculos
  const pagas = contas.filter(c => c.status === 'pago')
  const pendentes = contas.filter(c => c.status !== 'pago')
  const totalPagoNoSistema = pagas.reduce((s, c) => s + Number(c.valor), 0)
  const totalPendente = pendentes.reduce((s, c) => s + Number(c.valor), 0)
  const totalNaLista = contas.reduce((s, c) => s + Number(c.valor), 0)
  const totalPagoReal = TOTAL_PAGO_HISTORICO // pago antes de usar o sistema
  const pctPago = (totalPagoReal / TOTAL_CASAMENTO) * 100
  const diasRestantes = diasAte(DATA_CASAMENTO)
  const mesesRestantes = mesesAte(DATA_CASAMENTO)
  const porMesSugerido = mesesRestantes > 0 ? totalPendente / mesesRestantes : totalPendente

  // Agrupar pendentes por mês de vencimento
  const porMes: Record<string, Conta[]> = {}
  for (const c of pendentes) {
    const key = c.vencimento
      ? `${new Date(c.vencimento).getFullYear()}-${String(new Date(c.vencimento).getMonth() + 1).padStart(2, '0')}`
      : 'sem-data'
    if (!porMes[key]) porMes[key] = []
    porMes[key].push(c)
  }
  const mesesOrdenados = Object.keys(porMes).sort()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">💒 Casamento</h1>
            <p className="text-sm text-gray-500">03 de Outubro de 2026</p>
          </div>
          <button
            onClick={() => setAdicionando(true)}
            className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600"
          >
            + Adicionar conta
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 md:px-6 py-4 md:py-6 space-y-4">
        {/* Countdown */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{diasRestantes} dias</div>
              <div className="text-rose-100 text-sm mt-0.5">até o grande dia 💍</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{mesesRestantes} meses</div>
              <div className="text-rose-100 text-sm mt-0.5">para organizar</div>
            </div>
          </div>
          {/* Barra de progresso */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-rose-100 mb-1">
              <span>Pago: {formatarMoeda(totalPagoReal)}</span>
              <span>Total: {formatarMoeda(TOTAL_CASAMENTO)}</span>
            </div>
            <div className="h-3 bg-rose-400 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${Math.min(100, pctPago)}%` }}
              />
            </div>
            <div className="text-center text-xs text-rose-100 mt-1">{pctPago.toFixed(0)}% pago</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Já pago</div>
            <div className="text-lg font-bold text-green-600">{formatarMoeda(totalPagoReal)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{pagas.length} neste app</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">A pagar</div>
            <div className="text-lg font-bold text-red-500">{formatarMoeda(totalPendente)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{pendentes.length} parcelas</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
            <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Por mês</div>
            <div className="text-lg font-bold text-orange-500">{formatarMoeda(porMesSugerido)}</div>
            <div className="text-xs text-gray-400 mt-0.5">guardar/mês</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">Carregando...</div>
        ) : (
          <>
            {/* Contas por mês */}
            {mesesOrdenados.map(mesKey => {
              const items = porMes[mesKey]
              const totalMes = items.reduce((s, c) => s + Number(c.valor), 0)
              let label = 'Sem data'
              if (mesKey !== 'sem-data') {
                const [ano, mes] = mesKey.split('-')
                label = `${MESES_FULL[parseInt(mes)]} ${ano}`
              }
              const isUrgente = mesKey !== 'sem-data' && diasAte(new Date(`${mesKey}-01`)) <= 45

              return (
                <div key={mesKey} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${isUrgente ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      {isUrgente && <span className="text-red-500 text-sm">⚠️</span>}
                      <span className="text-sm font-semibold text-gray-700">{label}</span>
                    </div>
                    <span className={`text-sm font-bold ${isUrgente ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatarMoeda(totalMes)}
                    </span>
                  </div>
                  <div className="divide-y">
                    {items.map(c => (
                      <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                        <button
                          onClick={() => marcarPago(c.id)}
                          className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            c.status === 'pago'
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-rose-400'
                          }`}
                        >
                          {c.status === 'pago' && <span className="text-xs">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800">{c.fornecedor || c.descricao}</div>
                          {c.fornecedor && c.descricao !== c.fornecedor && (
                            <div className="text-xs text-gray-400">{c.descricao}</div>
                          )}
                          {c.vencimento && (
                            <div className="text-xs text-gray-400">
                              Venc. {new Date(c.vencimento).toLocaleDateString('pt-BR')}
                              {c.status === 'atrasado' && <span className="ml-1 text-red-500 font-medium">ATRASADO</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-sm font-bold ${c.status === 'pago' ? 'text-green-600 line-through' : 'text-gray-800'}`}>
                            {formatarMoeda(Number(c.valor))}
                          </div>
                        </div>
                        <button
                          onClick={() => excluir(c.id)}
                          className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0 ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {pendentes.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm border">
                <div className="text-4xl mb-3">🎉</div>
                <div className="text-lg font-semibold text-gray-800">Tudo pago!</div>
                <div className="text-sm text-gray-500 mt-1">Todas as contas do casamento estão quitadas.</div>
              </div>
            )}

            {/* Resumo fornecedores */}
            {contas.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700">Todos os fornecedores</h3>
                </div>
                <div className="divide-y">
                  {contas.map(c => (
                    <div key={c.id} className="px-4 py-2.5 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.status === 'pago' ? 'bg-green-400' : c.status === 'atrasado' ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <span className="text-sm text-gray-700 flex-1 truncate">{c.fornecedor || c.descricao}</span>
                      <span className={`text-sm font-medium flex-shrink-0 ${c.status === 'pago' ? 'text-green-600' : 'text-gray-800'}`}>
                        {formatarMoeda(Number(c.valor))}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                        c.status === 'pago' ? 'bg-green-100 text-green-700' :
                        c.status === 'atrasado' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {c.status === 'pago' ? 'Pago' : c.status === 'atrasado' ? 'Atrasado' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-gray-50 border-t flex justify-between">
                  <span className="text-sm font-semibold text-gray-700">Total na lista</span>
                  <span className="text-sm font-bold text-gray-900">{formatarMoeda(totalNaLista)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal adicionar */}
      {adicionando && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Nova conta do casamento</h3>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Fornecedor / Nome</label>
              <input
                type="text"
                placeholder="Ex: Sawanna Decoração"
                value={nova.fornecedor}
                onChange={e => setNova(p => ({ ...p, fornecedor: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Descrição / Serviço</label>
              <input
                type="text"
                placeholder="Ex: Decoração Cerimônia"
                value={nova.descricao}
                onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Valor (R$)</label>
                <input
                  type="text"
                  placeholder="Ex: 10500"
                  value={nova.valor}
                  onChange={e => setNova(p => ({ ...p, valor: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Vencimento</label>
                <input
                  type="date"
                  value={nova.vencimento}
                  onChange={e => setNova(p => ({ ...p, vencimento: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Observações</label>
              <input
                type="text"
                placeholder="Opcional"
                value={nova.observacoes}
                onChange={e => setNova(p => ({ ...p, observacoes: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setAdicionando(false)}
                className="flex-1 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando || !nova.descricao || !nova.valor}
                className="flex-1 py-2.5 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
