import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { EmailInput } from "@/components/ui/Input";
import { PATHS } from "@/routers/Paths";
import { useTranslation } from "react-i18next";
import { getUserFriendlyError } from "@/utils/error-messages";
import { getAuthErrorMessage } from "@/utils/auth-errors";

export default function ForgotPassword() {
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + PATHS.PASSWORD_RESET,
            });

            if (resetError) throw resetError;

            setMessage(t('password.sent_description'));
        } catch (err: any) {
            setError(getAuthErrorMessage(err, t) || getUserFriendlyError(err, t));
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="h-hero min-h-hero max-w-180 mx-auto relative flex flex-col items-center justify-center w-full md:mt-8">
            <div className="relative flex justify-center items-center w-full h-full px-4 py-4 md:py-8">
                <div className="absolute max-md:hidden top-0 left-0 w-full h-full border border-muted/15 rounded-4xl bg-surface/45 -z-10 mask-b-to-transparent mask-b-to-100%"></div>
                <div className="relative flex flex-col gap-8 w-full md:w-4/5 p-2 md:p-4 lg:p-8">
                    <div className="space-y-2 md:space-y-3">
                        <h1 className="font-semibold text-2xl md:text-3xl">{t('password.reset_title')}</h1>
                        <p className="text-2xs md:text-xs text-muted">{t('password.reset_description')}</p>
                    </div>

                    <form onSubmit={handleResetRequest} className="flex flex-col items-center gap-6">
                        <div className="flex flex-col gap-4 w-full">
                            <EmailInput value={email} onChange={(e: any) => setEmail(e.target.value)} required />
                            {error && <p className="text-xs text-danger text-center"> {error} </p>}
                            {message && <p className="text-xs text-success text-center"> {message} </p>}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="font-semibold text-white/95 w-full px-4 p-2 bg-primary rounded-xl disabled:opacity-50"
                        >
                            {loading ? t('common.loading') : t('password.cta_send_reset_link')}
                        </button>
                    </form>

                    <div className="flex justify-center w-full">
                        <Link to={PATHS.LOGIN} className="text-xs text-muted hover:text-foreground hover:underline">
                            {t('common.go_back')}
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
