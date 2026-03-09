import UserTable from "@/components/layout/admin/UserTable";
import { useTranslation } from "react-i18next";

export default function Users() {
    const { t } = useTranslation();
    return (
        <div className="w-full">
            <section className="flex flex-col pt-4 md:pt-6 w-full h-full mb-40">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="font-medium text-xl md:text-2xl text-heading tracking-tight">{t('admin.users.title')}</h1>
                    </div>
                </div>
                <div>
                    <UserTable />
                </div>
            </section>
        </div>
    );
}
