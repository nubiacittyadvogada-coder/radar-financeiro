'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { MESES } from '@/lib/utils'

export default function RelatorioPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState<any>(null)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    if (!u) { router.push('/login'); return }
    setUsuario(JSON.parse(u))
  }, [router])

  if (!usuario) return null

  const pdfUrl = api.getRelatorioUrl(usuario.id, mes, ano)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700">&larr; Voltar</button>
          <h1 className="text-xl font-bold">Relatório Mensal</h1>
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

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border text-center">
          <h2 className="text-lg font-semibold mb-4">
            Relatório de {MESES[mes]} / {ano}
          </h2>
          <div className="flex justify-center gap-4">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition inline-flex items-center gap-2"
            >
              Abrir PDF
            </a>
            <a
              href={pdfUrl}
              download
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              Download
            </a>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden" style={{ height: '80vh' }}>
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            title="Relatório PDF"
          />
        </div>
      </main>
    </div>
  )
}
