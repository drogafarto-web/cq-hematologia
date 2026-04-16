import React, { useState } from 'react';
import { z } from 'zod';
import { FirebaseError } from 'firebase/app';
import { signIn, signInWithGoogle } from '../services/authService';
import { haptic } from '../../../shared/hooks/useHaptic';

// ─── Validation ───────────────────────────────────────────────────────────────

const loginSchema = z.object({
    email: z.string().email('E-mail inválido'),
    password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
});

// ─── Firebase error messages ──────────────────────────────────────────────────

function authErrorMessage(error: unknown): string {
    if (!(error instanceof FirebaseError)) return 'Não foi possível acessar. Tente novamente.';
    switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'E-mail ou senha inválidos.';
        case 'auth/invalid-email':
            return 'E-mail inválido.';
        case 'auth/user-disabled':
            return 'Conta suspensa. Entre em contato com o administrador.';
        case 'auth/too-many-requests':
            return 'Muitas tentativas. Aguarde alguns minutos.';
        case 'auth/network-request-failed':
            return 'Erro de conexão. Verifique sua internet.';
        default:
            return 'Não foi possível acessar. Tente novamente.';
    }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
    return open ? (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ) : (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                fill="#4285F4"
            />
            <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#34A853"
            />
            <path
                d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
                fill="#FBBC05"
            />
            <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"
                fill="#EA4335"
            />
        </svg>
    );
}

function Spinner() {
    return (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [touched, setTouched] = useState({ email: false, password: false });

    // Real-time field errors — only shown after user has interacted with the field
    const emailError = touched.email && email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? 'E-mail inválido'
        : null;
    const passwordError = touched.password && password.length > 0 && password.length < 8
        ? `Senha deve ter ao menos 8 caracteres (${password.length}/8)`
        : null;

    const handleEmailSignIn = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const validation = loginSchema.safeParse({ email, password });
            if (!validation.success) {
                haptic.error();
                setError(validation.error.errors[0]?.message || 'Dados inválidos');
                setIsLoading(false);
                return;
            }

            await signIn(email, password);
            haptic.confirm();
            // onAuthStateChanged in useAuthFlow will handle the rest
        } catch (err) {
            haptic.error();
            setError(authErrorMessage(err));
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setIsGoogleLoading(true);

        try {
            await signInWithGoogle();
            haptic.confirm();
            // onAuthStateChanged in useAuthFlow will handle the rest
        } catch (err: unknown) {
            if (err instanceof FirebaseError && err.code === 'auth/popup-closed-by-user') {
                setError('');
            } else {
                haptic.error();
                setError(authErrorMessage(err));
            }
            setIsGoogleLoading(false);
        }
    };

    return (
        <div className="w-full px-6 py-8 sm:px-8 lg:px-12 animate-fade-in">
            <div className="max-w-sm">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Acesse sua conta
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Sistema restrito. Acesso autorizado.
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleEmailSignIn} autoComplete="on" className="space-y-5 mb-6">
                    {/* Email Field */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                            E-mail
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                            placeholder="seu.email@exemplo.com"
                            autoComplete="email"
                            inputMode="email"
                            aria-invalid={emailError ? 'true' : 'false'}
                            aria-describedby={emailError ? 'email-error' : undefined}
                            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition ${
                                emailError
                                    ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
                                    : 'border-gray-300 dark:border-gray-600 focus:ring-purple-600'
                            }`}
                            disabled={isLoading || isGoogleLoading}
                            required
                        />
                        {emailError && (
                            <p id="email-error" role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden><circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2"/><path d="M6.5 4v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="6.5" cy="9" r="0.6" fill="currentColor"/></svg>
                                {emailError}
                            </p>
                        )}
                    </div>

                    {/* Password Field */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                            Senha
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                aria-invalid={passwordError ? 'true' : 'false'}
                                aria-describedby={passwordError ? 'password-error' : undefined}
                                className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition pr-12 ${
                                    passwordError
                                        ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
                                        : 'border-gray-300 dark:border-gray-600 focus:ring-purple-600'
                                }`}
                                disabled={isLoading || isGoogleLoading}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-0 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                                tabIndex={-1}
                                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                                <EyeIcon open={showPassword} />
                            </button>
                        </div>
                        {passwordError && (
                            <p id="password-error" role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden><circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.2"/><path d="M6.5 4v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="6.5" cy="9" r="0.6" fill="currentColor"/></svg>
                                {passwordError}
                            </p>
                        )}
                    </div>

                    {/* Sign In Button */}
                    <button
                        type="submit"
                        disabled={isLoading || isGoogleLoading}
                        className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Spinner />
                                Entrando...
                            </>
                        ) : (
                            'Entrar'
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
                    <span className="text-gray-500 dark:text-gray-400 text-sm">— ou —</span>
                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
                </div>

                {/* Google Button */}
                <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading || isGoogleLoading}
                    className="w-full py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                    {isGoogleLoading ? (
                        <>
                            <Spinner />
                            <span className="text-gray-600 dark:text-gray-400">Conectando...</span>
                        </>
                    ) : (
                        <>
                            <GoogleIcon />
                            Continuar com Google
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default LoginForm;
