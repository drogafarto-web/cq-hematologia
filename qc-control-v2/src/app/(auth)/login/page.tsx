'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const result = await signIn('credentials', {
        email,
        senha,
        redirect: false,
      })
      if (result?.error) {
        setErro('Email ou senha inválidos')
      } else {
        router.push('/qc')
        router.refresh()
      }
    } catch {
      setErro('Erro ao tentar entrar. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white border border-border p-8">
      <h1 className="text-2xl font-semibold text-primary text-center mb-2">QC Control</h1>
      <p className="text-xs text-on-surface-variant text-center mb-8 uppercase tracking-wider">
        Controle Interno de Qualidade
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@hospital.test"
            className="h-12 px-4 border border-border-variant bg-white text-sm focus:outline-none focus:border-primary focus:border-2"
            autoComplete="email"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Senha
          </label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••"
            className="h-12 px-4 border border-border-variant bg-white text-sm focus:outline-none focus:border-primary focus:border-2"
            autoComplete="current-password"
            required
          />
        </div>

        {erro && (
          <div className="bg-error-container px-4 py-3 text-sm text-error">
            {erro}
          </div>
        )}

        <Button type="submit" loading={carregando} className="w-full">
          Entrar
        </Button>
      </form>
    </div>
  )
}
