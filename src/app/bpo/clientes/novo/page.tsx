'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function NovoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    nomeEmpresa: '',
    cnpj: '',
    setor: '',
    responsavel: '',
    telefone: '',
    email: '',
    senha: '',
    alertaWpp: false,
    telefoneWpp: '',
    metaReceita: '',
    metaLucro: '',
  })

  function update(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      await api.criarCliente({
        ...form,
        metaReceita: form.metaReceita ? parseFloat(form.metaReceita) : null,
        metaLucro: form.metaLucro ? parseFloat(form.metaLucro) : null,
      })
      router.push('/bpo/dashboard')
    } catch (err: any) {
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/bpo/dashboard')} className="text-gray-500 hover:text-gray-700">&larr; Voltar</button>
        <h1 className="text-xl font-bold">Novo Cliente</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa *</label>
              <input value={form.nomeEmpresa} onChange={(e) => update('nomeEmpresa', e.target.value)} required className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input value={form.cnpj} onChange={(e) => update('cnpj', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
              <input value={form.setor} onChange={(e) => update('setor', e.target.value)} placeholder="Ex: Advocacia" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
              <input value={form.responsavel} onChange={(e) => update('responsavel', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input value={form.telefone} onChange={(e) => update('telefone', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email de acesso</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha de acesso</label>
              <input type="password" value={form.senha} onChange={(e) => update('senha', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <hr />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta de receita mensal (R$)</label>
              <input type="number" step="0.01" value={form.metaReceita} onChange={(e) => update('metaReceita', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta de lucro mínimo (R$)</label>
              <input type="number" step="0.01" value={form.metaLucro} onChange={(e) => update('metaLucro', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" checked={form.alertaWpp} onChange={(e) => update('alertaWpp', e.target.checked)} className="rounded" id="alertaWpp" />
            <label htmlFor="alertaWpp" className="text-sm text-gray-700">Enviar alertas por WhatsApp</label>
          </div>

          {form.alertaWpp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp para alertas</label>
              <input value={form.telefoneWpp} onChange={(e) => update('telefoneWpp', e.target.value)} placeholder="5531999990000" className="w-full px-3 py-2 border rounded-lg" />
            </div>
          )}

          {erro && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{erro}</div>}

          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Criando...' : 'Criar Cliente'}
          </button>
        </form>
      </main>
    </div>
  )
}
