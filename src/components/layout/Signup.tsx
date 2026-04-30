
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useNavigate, Link } from "react-router-dom"
import { PATHS } from "@/routers/Paths"
import { EmailInput, Input, PasswordInput } from "@components/ui/Input"
import { LegalLinks } from "@/constants"
import Spinner from "@components/common/Spinner"
import { useTranslation } from "react-i18next"
import { getAuthErrorMessage } from "@/utils/auth-errors"
import { getUserFriendlyError } from "@/utils/error-messages"

export function SignupLayout() {
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")
    const [phone, setPhone] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()
    const { t } = useTranslation()

    const handleGoogleSignup = async () => {
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

    // Normalizes Algerian local phone formats to international E.164 format
    const normalizePhone = (raw: string): string => {
        let p = raw.trim().replace(/[\s\-().]/g, '');
        if (p.startsWith('05') || p.startsWith('06') || p.startsWith('07')) {
            return '+213' + p.slice(1);
        } else if (/^[567]\d{8}$/.test(p)) {
            return '+213' + p;
        } else if (p.startsWith('00213')) {
            return '+' + p.slice(2);
        } else if (p.startsWith('213') && p.length === 12) {
            return '+' + p;
        }
        return p; // already international or unknown format
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // --- Client-side validation ---
            if (!firstName.trim() || !lastName.trim()) {
                throw new Error(t('auth.error_name_required') || 'Please enter your full name.')
            }

            const phoneDigits = phone.trim().replace(/[\s\-().]/g, '')
            if (phoneDigits.length < 9) {
                throw new Error(t('auth.error_invalid_phone') || 'Please enter a valid phone number.')
            }

            const normalizedPhone = normalizePhone(phone)

            // --- Check for duplicate phone number ---
            const { data: existingPhone } = await supabase
                .from('profiles')
                .select('id')
                .eq('phone', normalizedPhone)
                .maybeSingle()

            if (existingPhone) {
                throw new Error(t('auth.error_phone_taken') || 'This phone number is already linked to an account.')
            }

            // --- Attempt signup (Supabase handles duplicate email) ---
            const { data, error: signupError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: `${firstName} ${lastName}`.trim(),
                        phone: normalizedPhone
                    }
                }
            })

            if (signupError) {
                setError(getAuthErrorMessage(signupError, t))
                return
            }

            if (!data.user) throw new Error(t('auth.error_failed_signup'))

            navigate(PATHS.VERIFY_OTP, { state: { email } })

        } catch (err: any) {
            console.error("Signup error:", err)
            setError(getUserFriendlyError(err, t))
        } finally {
            setLoading(false)
        }
    }

    return (

        <div className="relative flex flex-col gap-8 w-full md:w-4/5 md:pt-8">

            {/* Form Header */}
            <div className="flex flex-col items-center gap-3">
                <h1 className="font-semibold text-center text-lg xs:text-2xl md:text-4xl"> {t('auth.signup_to')} <span className="text-transparent bg-linear-to-br from-foreground to-primary to-65% bg-clip-text">DecoRight</span> </h1>
                <p className="text-ellipsis-2line text-2xs md:text-xs text-muted">{t('auth.signup_description')}</p>
            </div>

            <form onSubmit={handleSignup} className="flex flex-col items-center gap-8">

                <div className="flex flex-col gap-4 w-full">
                    <div className="flex max-xs:flex-col md:flex-col lg:flex-row gap-3 md:gap-4 w-full">
                        <div className="flex flex-col gap-1 w-full">
                            <label htmlFor="field_first_name" className="font-medium text-xs">{t('auth.labels.first_name')}</label>
                            <Input type="text" id="field_first_name" placeholder={t('auth.placeholders.first_name')} value={firstName} onChange={(e: any) => setFirstName(e.target.value)} required />
                        </div>
                        <div className="flex flex-col gap-1 w-full">
                            <label htmlFor="field_last_name" className="font-medium text-xs">{t('auth.labels.last_name')}</label>
                            <Input type="text" id="field_last_name" placeholder={t('auth.placeholders.last_name')} value={lastName} onChange={(e: any) => setLastName(e.target.value)} required />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 w-full">
                        <label htmlFor="field_phone" className="font-medium text-xs">{t('auth.labels.phone')}</label>
                        <Input id="field_phone" placeholder={t('auth.placeholders.phone')} value={phone} onChange={(e: any) => setPhone(e.target.value)} required />
                    </div>

                    <div className="flex flex-col gap-1 w-full">
                        <label htmlFor="field_email" className="font-medium text-xs">{t('auth.labels.email')}</label>
                        <EmailInput id="field_email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                        <label htmlFor="field_password" className="font-medium text-xs">{t('auth.labels.password')}</label>
                        <PasswordInput id="field_password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
                    </div>
                </div>

                {error && <p className="text-xs text-danger text-center"> {error} </p>}

                <div className="ring-2 ring-muted/10 hover:ring-primary/40 active::ring-primary/45 p-px w-full rounded-xl">
                    <button
                        type="submit"
                        disabled={loading}
                        className="font-semibold text-white/95 w-full px-4 p-2 bg-primary rounded-xl disabled:opacity-50"
                    >
                        <Spinner status={loading} size="sm"> {t('auth.signup')} </Spinner>
                    </button>
                </div>
            </form>

            <div className="flex items-center gap-3 w-full">
                <hr className="flex-1 border-t border-muted/25" />
                <span className="text-xs text-muted">{t('auth.or')}</span>
                <hr className="flex-1 border-t border-muted/25" />
            </div>

            <button
                type="button"
                disabled={googleLoading}
                onClick={handleGoogleSignup}
                className="flex items-center justify-center gap-2 w-full px-4 p-2 border border-muted/25 bg-surface rounded-xl hover:bg-emphasis transition-colors disabled:opacity-50"
            >
                <svg className="size-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm font-medium">{t('auth.signup_with_google')}</span>
            </button>

            <div className="flex flex-col items-center w-full">
                <Link to={'/login'}> <p className="text-xs text-muted"> {t('auth.already_have_account')} <span className="font-medium text-foreground hover:underline active:underline"> {t('auth.login_now')} </span> </p> </Link>
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
