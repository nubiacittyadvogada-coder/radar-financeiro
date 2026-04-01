'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { formatarMoeda } from '@/lib/utils'

export default function BpoDashboardPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo === 'cliente') { router.push('/dashboard'); return }
    carregarClientes()
  }, [router])

  async function carregarClientes() {
    try {
      const data = await api.getClientes()
      setClientes(data)
    } catch {} finally {
      setLoading(false)
    }
  }

  const totalClientes = clientes.length
  const comImportacao = clientes.filter((c: any) => c._count?.importacoes > 0).length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Radar Financeiro — BPO</h1>
          <p className="text-sm text-gray-500">Gestão de clientes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/bpo/clientes/novo')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Novo Cliente
          </button>
          <button onClick={() => { api.logout(); router.push('/login') }} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Sair</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Cards globais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-sm text-gray-500">Clientes ativos</p>
            <p className="text-3xl font-bold text-blue-600">{totalClientes}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-sm text-gray-500">Com importações</p>
            <p className="text-3xl font-bold text-green-600">{comImportacao}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-sm text-gray-500">Sem importação</p>
            <p className="text-3xl font-bold text-amber-600">{totalClientes - comImportacao}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-sm text-gray-500">Total fechamentos</p>
            <p className="text-3xl font-bold text-gray-700">
              {clientes.reduce((acc: number, c: any) => acc + (c._count?.fechamentos || 0), 0)}
            </p>
          </div>
        </div>

        {/* Tabela de clientes */}
        {loading ? (
          <p className="text-gray-500">Carregando...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Setor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Importações</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fechamentos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientes.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{c.nomeEmpresa}</p>
                      <p className="text-xs text-gray-500">{c.responsavel} — {c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.setor || '—'}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">{c._count?.importacoes || 0}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">{c._count?.fechamentos || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => router.push(`/bpo/clientes/${c.id}/importar`)}
                          className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                        >
                          Importar
                        </button>
                        <button
                          onClick={() => router.push(`/bpo/clientes/${c.id}`)}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        >
                          Ver painel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
