import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useAuth from "@/hooks/useAuth";
import { PATHS } from "@/routers/Paths";
import Spinner from "@components/common/Spinner";

/**
 * Landing page for third-party sign-in returns (currently Google).
 *
 * signInWithOAuth sends the user here after Supabase completes the exchange.
 * The session is not ready on first paint: the client has detectSessionInUrl
 * enabled, so it parses the URL, then AuthProvider reloads the profile through
 * onAuthStateChange. This page waits for that to settle and then routes by
 * role, rather than leaving the user on a blank screen.
 *
 * It deliberately lives OUTSIDE RequireAuth. Wrapping it would race the guard
 * against session detection and bounce the user to /login before the session
 * exists.
 */
export default function AuthCallback() {
    const { user, loading, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();

    // Supabase reports a refused or cancelled sign-in on the query string, and
    // on the hash fragment for implicit-flow errors. Check both.
    const [providerError] = useState(() => {
        const fromQuery = searchParams.get("error_description") || searchParams.get("error");
        if (fromQuery) return fromQuery;

        const hash = window.location.hash.startsWith("#")
            ? new URLSearchParams(window.location.hash.slice(1))
            : null;
        return hash?.get("error_description") || hash?.get("error") || null;
    });

    useEffect(() => {
        if (providerError || loading) return;

        if (user) {
            navigate(isAdmin ? PATHS.ADMIN.DASHBOARD : PATHS.CLIENT.ROOT, { replace: true });
            return;
        }

        // Auth finished with no session. The provider redirected here without a
        // usable code, so send them back rather than spinning forever.
        navigate(PATHS.LOGIN, { replace: true });
    }, [user, loading, isAdmin, providerError, navigate]);

    if (providerError) {
        return (
            <main>
                <section className="h-hero flex flex-col items-center justify-center gap-6 text-center">
                    <div className="space-y-3 max-w-sm">
                        <h1 className="font-semibold text-xl md:text-2xl">
                            {t("auth.callback.failed")}
                        </h1>
                        <p className="text-xs text-muted break-words">{providerError}</p>
                    </div>
                    <Link
                        to={PATHS.LOGIN}
                        replace
                        className="font-semibold text-sm text-white/95 px-6 py-2 bg-primary rounded-xl"
                    >
                        {t("auth.callback.back_to_login")}
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <main>
            <section className="h-hero flex flex-col items-center justify-center gap-3">
                <Spinner status size="lg" />
                <span className="text-sm text-muted">{t("auth.callback.signing_in")}</span>
            </section>
        </main>
    );
}
