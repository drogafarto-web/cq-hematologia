import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isAuth = !!req.auth
  const isLoginPage = req.nextUrl.pathname.startsWith('/login')

  if (isAuth && isLoginPage) {
    return NextResponse.redirect(new URL('/qc', req.url))
  }

  if (!isAuth && !isLoginPage && !req.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|public).*)'],
}
