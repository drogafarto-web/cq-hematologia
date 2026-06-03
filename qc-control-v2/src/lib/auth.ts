import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const credenciaisSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      authorize: async (credentials) => {
        const parsed = credenciaisSchema.safeParse(credentials)
        if (!parsed.success) return null
        const user = await prisma.usuario.findUnique({ where: { email: parsed.data.email } })
        if (!user) return null
        const valid = await bcrypt.compare(parsed.data.senha, user.senhaHash)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.nome, role: user.papel }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      return session
    },
  },
})
