'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('radar_token')
    const usuario = localStorage.getItem('radar_usuario')

    if (!token || !usuario) {
      router.push('/login')
      return
    }

    const u = JSON.parse(usuario)
    if (u.tipo === 'usuario') {
      router.push('/pessoal/dashboard')
    } else if (u.tipo === 'cliente') {
      router.push('/dashboard')
    } else {
      router.push('/bpo/dashboard')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Redirecionando...</p>
    </div>
  )
}
