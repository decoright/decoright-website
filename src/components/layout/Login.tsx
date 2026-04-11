import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useNavigate, Link } from "react-router-dom"
import { EmailInput, PasswordInput } from "@components/ui/Input"
import { LegalLinks } from "@/constants"
import Spinner from "@components/common/Spinner"
import { PATHS } from "@/routers/Paths"
import { useTranslation } from "react-i18next"
import { getAuthErrorMessage } from "@/utils/auth-errors"

export function LoginLayout() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()
    const { t } = useTranslation()
    
    const handleGoogleLogin = async () => {
        setGoogleLoading(true)
        setError(null)
        try {
            const { error: googleError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            })
            if (googleError) throw googleError
        } catch (err: any) {
            setError(getAuthErrorMessage(err, t))
        } finally {
            setGoogleLoading(false)
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (loginError) throw loginError

            // Redirect will be handled by AuthProvider/AppRouter usually,
            // but we can force it here if needed.
            navigate(PATHS.ROOT)
        } catch (err: any) {
            setError(getAuthErrorMessage(err, t))
        } finally {
            setLoading(false)
        }
    }

    return (

        <div className="relative flex flex-col gap-8 w-full md:w-4/5 md:pt-8">

            <form onSubmit={handleLogin} className="flex flex-col items-center gap-8">

                <div className="flex flex-col gap-4 w-full">
                    <EmailInput value={email} onChange={(e: any) => setEmail(e.target.value)} required />
                    <PasswordInput value={password} onChange={(e: any) => setPassword(e.target.value)} required />

                    {error && <p className="text-xs text-danger text-center"> {error} </p>}

                    <div className="flex justify-between items-center w-full h-fit px-1">
                        {/* Save Log Info */}
                        <div className="inline-flex gap-2 rtl:space-x-reverse content-center cursor-pointer w-full">
                            <input id="save-login-info" type="checkbox" name="remember" className="accent-primary" />
                            <label htmlFor="save-login-info" className="text-xs md:text-sm"> {t('auth.remember_me')} </label>
                        </div>
                        <Link to={PATHS.PASSWORD_RESET} className="min-w-max w-fit"> <p className="text-2xs md:text-xs hover:text-primary px-1 underline"> {t('auth.forgot_password')} </p>  </Link>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="font-semibold text-white/95 w-full px-4 p-2 bg-primary rounded-xl disabled:opacity-50"
                >
                    <Spinner status={loading} size="sm"> {t('auth.login')} </Spinner>
                </button>
            </form>

            <div className="flex items-center gap-3 w-full">
                <hr className="flex-1 border-t border-muted/25" />
                <span className="text-xs text-muted">{t('auth.or')}</span>
                <hr className="flex-1 border-t border-muted/25" />
            </div>

            <button
                type="button"
                disabled={googleLoading}
                onClick={handleGoogleLogin}
                className="flex items-center justify-center gap-2 w-full px-4 p-2 border border-muted/25 bg-surface rounded-xl hover:bg-emphasis transition-colors disabled:opacity-50"
            >
                <svg className="size-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm font-medium">{t('auth.login_with_google')}</span>
            </button>

            <div className="flex flex-col items-center w-full">
                <Link to={'/signup'}> <p className="text-xs text-muted"> {t('auth.no_account')} <span className="font-medium text-foreground hover:underline active:underline"> {t('auth.signup_now')} </span> </p> </Link>
                <hr className="w-full border-t border-muted/25 my-4 mask-x-to-transparent mask-x-from-45%" />

                {/* Legal Links */}
                <nav className="flex flex-wrap items-center">
                    {LegalLinks.map((item, index) => (
                        <Link key={index} to={item.path} className="flex justify-center text-3xs sm:text-2xs text-muted hover:underline active:underline after:content-['•'] after:mx-2 rtl:after:mx-2 last:after:content-none"> {t(`footer.legal.${item.key}`)} </Link>
                    ))}
                </nav>

            </div>
        </div>
    )
}