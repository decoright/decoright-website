import { LogoutButton } from "@/components/common/Confirm";
import { PATHS } from "@/routers/Paths";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRightStartOnRectangle, CheckCircle, Home } from "@/icons";

export default function PasswordDone() {

    const { t } = useTranslation()

    return (

        <main>
            <section className="h-hero min-h-hero max-w-180 mx-auto relative flex flex-col items-center justify-center w-full mt-8">

                <div className="absolute right-full w-full h-[calc(100svh-24rem)] md:h-[calc(100svh-22rem)] border border-muted/20 rounded-4xl mask-l-to-transparent mask-l-to-30% overflow-hidden"></div>

                <div className="relative flex flex-col justify-center gap-6 w-full h-full px-2 sm:px-8 md:px-16 p-4 md:py-8">
                    <div className="absolute top-0 left-0 w-full h-full border border-muted/15 rounded-4xl bg-surface/75 -z-10 mask-b-to-transparent mask-b-to-100%"></div>

                    <div className="flex flex-col items-center w-full mb-8">
                        <div className="flex items-center justify-center size-20 md:size-24 bg-success/10 text-success rounded-full mb-6">
                            <CheckCircle className="size-12 md:size-16" />
                        </div>

                        <div className="space-y-3 text-center">
                            <h1 className="font-semibold text-2xl md:text-3xl text-heading"> {t('password.done_title')} </h1>
                            <p className="text-sm md:text-base text-muted max-w-sm mx-auto"> {t('password.done_description')} </p>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">

                        <Link to={PATHS.ROOT}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 font-semibold text-sm px-6 py-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
                        > <Home className="size-5" /> {t('nav.home')} </Link>

                        <LogoutButton
                            className="w-full sm:w-auto flex items-center justify-center gap-2 font-medium text-sm px-5 py-3 border border-muted/25 rounded-xl hover:bg-muted/5 transition-colors"
                        > <span className="flex items-center gap-3"> {t('auth.logout')} <ArrowRightStartOnRectangle className="size-5" /></span> </LogoutButton>

                    </div>

                </div>

                <div className="absolute left-full w-full h-[calc(100svh-24rem)] md:h-[calc(100svh-22rem)] border border-muted/20 rounded-4xl mask-r-to-transparent mask-r-to-30% overflow-hidden"></div>
            </section>
        </main>

    )
}
