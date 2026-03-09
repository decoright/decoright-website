import ServiceCreateLayout from "@/components/layout/admin/services/ServiceCreate";
import { useTranslation } from "react-i18next";

export default function ServiceCreate() {
    const { t } = useTranslation();
    return (
        <main>
            <section className="relative flex flex-col w-full mb-20">
                <div className="relative flex flex-col gap-8 h-full">
                    <h1 className="font-semibold text-lg md:text-2xl"> {t('admin.services.create_title')} </h1>
                    {/* Service content goes here */}

                    <div className="w-full lg:w-2/3 border border-red-400">
                        {/* Service creation form or content goes here */}
                        <ServiceCreateLayout />
                    </div>

                </div>
            </section>
        </main>
    )
}