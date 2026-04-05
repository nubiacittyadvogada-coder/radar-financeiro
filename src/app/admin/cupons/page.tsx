'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Cupom {
  id: string
  codigo: string
  descricao: string | null
  tipo: string
  valor: number
  diasTrial: number | null
  planoAlvo: string
  ativo: boolean
  usoMax: number | null
  usoAtual: number
  validoAte: string | null
  criadoEm: string
  _count: { usos: number }
}

const TIPOS = ['trial', 'percentual', 'fixo']
const PLANOS_ALVO = ['pro', 'premium', 'ambos']

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function AdminCuponsPage() {
  const router = useRouter()
  const [cupons, setCupons] = useState<Cupom[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  const [form, setForm] = useState({
    codigo: '',
    descricao: '',
    tipo: 'trial',
    valor: '',
    diasTrial: '30',
    planoAlvo: 'pro',
    usoMax: '',
    validoAte: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')

  function getToken() {
    try { return localStorage.getItem('radar_token') || '' } catch { return '' }
  }

  async function carregar() {
    setCarregando(true)
    try {
      const res = await fetch('/api/v2/admin/cupons', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      if (!res.ok) { setErro(data.erro || 'Erro ao carregar'); return }
      setCupons(data)
    } catch {
      setErro('Erro de conexão')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  function copiar(codigo: string) {
    navigator.clipboard.writeText(codigo).then(() => {
      setCopiado(codigo)
      setTimeout(() => setCopiado(null), 1500)
    })
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErroForm('')
    setSalvando(true)
    try {
      const body: any = {
        codigo: form.codigo,
        descricao: form.descricao || null,
        tipo: form.tipo,
        valor: form.valor ? Number(form.valor) : 0,
        diasTrial: form.diasTrial ? Number(form.diasTrial) : null,
        planoAlvo: form.planoAlvo,
        usoMax: form.usoMax ? Number(form.usoMax) : null,
        validoAte: form.validoAte || null,
      }
      const res = await fetch('/api/v2/admin/cupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErroForm(data.erro || 'Erro ao salvar'); return }
      setShowModal(false)
      setForm({ codigo: '', descricao: '', tipo: 'trial', valor: '', diasTrial: '30', planoAlvo: 'pro', usoMax: '', validoAte: '' })
      await carregar()
    } catch {
      setErroForm('Erro de conexão')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← Admin</Link>
          <span className="text-gray-300">|</span>
          <h1 className="font-bold text-gray-900 text-lg">Cupons de Desconto</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-4 py-2 rounded-xl transition shadow-sm"
        >
          + Novo cupom
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="text-center py-20 text-gray-400">Carregando cupons...</div>
        ) : cupons.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-4">Nenhum cupom cadastrado ainda.</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-green-600 underline text-sm"
            >
              Criar o primeiro cupom
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Código</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Tipo</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Plano</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Trial</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Usos</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Válido até</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Status</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {cupons.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900 text-xs bg-gray-100 px-2 py-1 rounded">
                          {c.codigo}
                        </span>
                        <button
                          onClick={() => copiar(c.codigo)}
                          title="Copiar código"
                          className="text-gray-400 hover:text-green-600 transition text-xs"
                        >
                          {copiado === c.codigo ? '✓' : '📋'}
                        </button>
                      </div>
                      {c.descricao && (
                        <p className="text-xs text-gray-400 mt-0.5">{c.descricao}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                        c.tipo === 'trial' ? 'bg-blue-50 text-blue-700'
                        : c.tipo === 'percentual' ? 'bg-purple-50 text-purple-700'
                        : 'bg-orange-50 text-orange-700'
                      }`}>
                        {c.tipo}
                        {c.tipo === 'percentual' && ` ${c.valor}%`}
                        {c.tipo === 'fixo' && ` R$ ${Number(c.valor).toFixed(2)}`}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-gray-700 font-medium capitalize">{c.planoAlvo}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {c.diasTrial ? `${c.diasTrial} dias` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-gray-700">{c.usoAtual}</span>
                      <span className="text-gray-400">/{c.usoMax ?? '∞'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {formatDate(c.validoAte)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                        c.ativo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal: novo cupom */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b">
              <h2 className="font-bold text-gray-900 text-lg">Novo Cupom</h2>
              <button onClick={() => { setShowModal(false); setErroForm('') }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <form onSubmit={salvar} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Código *</label>
                  <input
                    type="text"
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                    required
                    placeholder="EX: PROMO30"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo *</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Ex: 30 dias grátis no plano Pro"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Plano alvo *</label>
                  <select
                    value={form.planoAlvo}
                    onChange={(e) => setForm({ ...form, planoAlvo: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                  >
                    {PLANOS_ALVO.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                {form.tipo === 'trial' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Dias de trial</label>
                    <input
                      type="number"
                      value={form.diasTrial}
                      onChange={(e) => setForm({ ...form, diasTrial: e.target.value })}
                      min="1"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Valor {form.tipo === 'percentual' ? '(%)' : '(R$)'}
                    </label>
                    <input
                      type="number"
                      value={form.valor}
                      onChange={(e) => setForm({ ...form, valor: e.target.value })}
                      min="0"
                      step="0.01"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Uso máximo</label>
                  <input
                    type="number"
                    value={form.usoMax}
                    onChange={(e) => setForm({ ...form, usoMax: e.target.value })}
                    min="1"
                    placeholder="Ilimitado"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Válido até</label>
                  <input
                    type="date"
                    value={form.validoAte}
                    onChange={(e) => setForm({ ...form, validoAte: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                  />
                </div>
              </div>

              {erroForm && (
                <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {erroForm}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setErroForm('') }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-sm px-6 py-2 rounded-xl transition"
                >
                  {salvando ? 'Salvando...' : 'Criar cupom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
