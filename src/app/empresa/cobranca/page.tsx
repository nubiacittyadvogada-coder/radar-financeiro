'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

type Devedor = {
  id: string
  nome: string
  cpfCnpj?: string
  telefone?: string
  email?: string
  perfilDevedor: string
  totalDevido: number
  totalPago: number
  cobrancas: Array<{
    id: string
    descricao: string
    valor: number
    vencimento: string
    status: string
    asaasLink?: string
  }>
  _count: { mensagens: number }
}

const PERFIL_LABEL: Record<string, { label: string; color: string }> = {
  primeiro_atraso: { label: 'Primeiro atraso', color: 'bg-yellow-100 text-yellow-700' },
  recorrente: { label: 'Recorrente', color: 'bg-orange-100 text-orange-700' },
  longo_prazo: { label: 'Longo prazo', color: 'bg-red-100 text-red-700' },
}

export default function CobrancaPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [devedores, setDevedores] = useState<Devedor[]>([])
  const [loading, setLoading] = useState(true)
  const [cobrando, setCobrando] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    nome: '', cpfCnpj: '', email: '', telefone: '',
    perfilDevedor: 'primeiro_atraso',
    descricao: '', valor: '', vencimento: '',
  })
  // Estado para nova cobrança em devedor existente
  const [showNovaCobranca, setShowNovaCobranca] = useState<string | null>(null) // devedorId
  const [formCobranca, setFormCobranca] = useState({ descricao: '', valor: '', vencimento: '' })
  const [salvandoCobranca, setSalvandoCobranca] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregarDevedores(t)
  }, [router])

  async function carregarDevedores(t: string) {
    setLoading(true)
    const res = await fetch('/api/v2/empresa/devedores', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setDevedores(await res.json())
    setLoading(false)
  }

  async function cobrar(devedorId: string) {
    if (!token) return
    setCobrando(devedorId)
    try {
      const res = await fetch(`/api/v2/empresa/devedores/${devedorId}/cobrar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      const enviados = data.resultados.filter((r: any) => r.enviado).length
      alert(`Cobrança enviada! ${enviados} mensagem(ns) enviada(s) via WhatsApp.`)
      carregarDevedores(token)
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setCobrando(null)
    }
  }

  async function cadastrarDevedor() {
    if (!token || !form.nome || !form.descricao || !form.valor || !form.vencimento) {
      setErro('Preencha nome, descrição, valor e vencimento')
      return
    }
    setErro('')
    try {
      const res = await fetch('/api/v2/empresa/devedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome: form.nome,
          cpfCnpj: form.cpfCnpj || null,
          email: form.email || null,
          telefone: form.telefone || null,
          perfilDevedor: form.perfilDevedor,
          totalDevido: Number(form.valor),
          cobranca: { descricao: form.descricao, valor: Number(form.valor), vencimento: form.vencimento },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setShowForm(false)
      setForm({ nome: '', cpfCnpj: '', email: '', telefone: '', perfilDevedor: 'primeiro_atraso', descricao: '', valor: '', vencimento: '' })
      carregarDevedores(token)
    } catch (err: any) {
      setErro(err.message)
    }
  }

  async function adicionarCobranca(devedorId: string) {
    if (!token || !formCobranca.descricao || !formCobranca.valor || !formCobranca.vencimento) return
    setSalvandoCobranca(true)
    try {
      const res = await fetch(`/api/v2/empresa/devedores/${devedorId}/cobrancas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          descricao: formCobranca.descricao,
          valor: Number(formCobranca.valor),
          vencimento: formCobranca.vencimento,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setShowNovaCobranca(null)
      setFormCobranca({ descricao: '', valor: '', vencimento: '' })
      carregarDevedores(token)
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setSalvandoCobranca(false)
    }
  }

  const totalInadimplente = devedores.reduce((s, d) => s + Number(d.totalDevido), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestão de Cobranças</h1>
          <p className="text-sm text-gray-500">
            {devedores.length} devedor(es) — Total: {formatarMoeda(totalInadimplente)}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          + Cadastrar devedor
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Formulário novo devedor */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
              <h2 className="text-lg font-bold mb-4">Cadastrar devedor</h2>
              <div className="space-y-3">
                <input
                  placeholder="Nome *"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="CPF/CNPJ"
                    value={form.cpfCnpj}
                    onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    placeholder="WhatsApp (5531...)"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <input
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <select
                  value={form.perfilDevedor}
                  onChange={(e) => setForm({ ...form, perfilDevedor: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="primeiro_atraso">Primeiro atraso</option>
                  <option value="recorrente">Recorrente</option>
                  <option value="longo_prazo">Longo prazo</option>
                </select>
                <hr />
                <input
                  placeholder="Descrição do débito *"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Valor *"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    placeholder="Vencimento *"
                    value={form.vencimento}
                    onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              {erro && <p className="text-red-600 text-sm mt-2">{erro}</p>}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={cadastrarDevedor}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Cadastrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal nova cobrança para devedor existente */}
        {showNovaCobranca && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-lg font-bold mb-1">Nova cobrança</h2>
              <p className="text-sm text-gray-500 mb-4">
                {devedores.find((d) => d.id === showNovaCobranca)?.nome}
              </p>
              <div className="space-y-3">
                <input
                  placeholder="Descrição do débito *"
                  value={formCobranca.descricao}
                  onChange={(e) => setFormCobranca({ ...formCobranca, descricao: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Valor *"
                    value={formCobranca.valor}
                    onChange={(e) => setFormCobranca({ ...formCobranca, valor: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    value={formCobranca.vencimento}
                    onChange={(e) => setFormCobranca({ ...formCobranca, vencimento: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowNovaCobranca(null)}
                  className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => adicionarCobranca(showNovaCobranca)}
                  disabled={salvandoCobranca || !formCobranca.descricao || !formCobranca.valor || !formCobranca.vencimento}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {salvandoCobranca ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : devedores.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-gray-500">Nenhum devedor cadastrado.</p>
            <p className="text-sm text-gray-400 mt-2">Cadastre devedores para ativar a régua de cobrança automática.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {devedores.map((d) => {
              const perfil = PERFIL_LABEL[d.perfilDevedor] || { label: d.perfilDevedor, color: 'bg-gray-100 text-gray-600' }
              const totalPendente = d.cobrancas.reduce((s, c) => s + Number(c.valor), 0)
              return (
                <div key={d.id} className="bg-white rounded-xl p-5 shadow-sm border">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-gray-900">{d.nome}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${perfil.color}`}>
                          {perfil.label}
                        </span>
                      </div>
                      {d.telefone && <div className="text-xs text-gray-500">📱 {d.telefone}</div>}
                      {d.email && <div className="text-xs text-gray-500">✉️ {d.email}</div>}
                      <div className="text-sm text-red-600 font-semibold mt-2">
                        {formatarMoeda(d.totalDevido)} em aberto
                        {d._count.mensagens > 0 && (
                          <span className="ml-2 text-xs text-gray-400 font-normal">
                            {d._count.mensagens} msg(s) enviada(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <button
                        onClick={() => cobrar(d.id)}
                        disabled={cobrando === d.id || d.cobrancas.length === 0}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        {cobrando === d.id ? 'Enviando...' : '📲 Cobrar agora'}
                      </button>
                      <button
                        onClick={() => {
                          setFormCobranca({ descricao: '', valor: '', vencimento: '' })
                          setShowNovaCobranca(d.id)
                        }}
                        className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"
                      >
                        + Nova cobrança
                      </button>
                    </div>
                  </div>

                  {d.cobrancas.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {d.cobrancas.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-sm bg-red-50 px-3 py-2 rounded-lg">
                          <span className="text-gray-700">{c.descricao}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-red-600 font-medium">{formatarMoeda(c.valor)}</span>
                            <span className="text-gray-400 text-xs">
                              venc. {new Date(c.vencimento).toLocaleDateString('pt-BR')}
                            </span>
                            {c.asaasLink && (
                              <a
                                href={c.asaasLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 underline"
                              >
                                Link PIX
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
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
