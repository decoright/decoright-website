import Spinner from "@/components/common/Spinner";
import { PButton } from "@/components/ui/Button";
import { SCTALink } from "@/components/ui/CTA";
import FileUploadPanel from "@/components/ui/FileUploadPanel";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function ServiceCreateLayout() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        // formData items read but not directly used in this logic
        formData.get('service-title');
        formData.get('service-description');

        try {
            // Create the service here
            navigate(-1); // Go back after success
        } catch (error) {
            console.error("Failed to create service:", error);
            alert(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} id="service-create-form" className="flex flex-col gap-10">

            {/* Inputs & Data */}
            <div className="flex max-lg:flex-col gap-8 w-full h-full">
                <div className="flex flex-col gap-6 w-full h-full">

                    <div className="flex flex-col gap-2 h-full">
                        <label htmlFor="service-title" className="font-medium text-xs text-muted px-1"> {t('admin.service_types.form_label_title_en')} </label>
                        <input type="text" name="service-title" id="service-title" placeholder={t('admin.services.search_placeholder')} required
                            className="w-full p-2.5 text-sm text-muted bg-emphasis/75 rounded-lg cursor-text outline-1 outline-muted/15 hover:outline-muted/35 focus:outline-primary/45" />
                    </div>

                    <div className="flex flex-col gap-2 h-full">
                        <label htmlFor="service-description" className="font-medium text-xs text-muted px-1"> {t('admin.service_types.form_label_description')} </label>
                        <textarea name="service-description" id="service-description" rows={5} placeholder={t('admin.service_types.form_placeholder_desc')} required
                            className="w-full h-full p-2.5 text-sm bg-emphasis/75 rounded-lg outline-1 outline-muted/15 hover:outline-muted/35 focus:outline-primary/45">
                        </textarea>
                    </div>

                    <FileUploadPanel />
                </div>
            </div>

            {/* CTA & Submit */}
            <div className="flex max-xs:flex-col md:flex-row gap-3 md:gap-4 w-full md:w-fit">
                <PButton type="submit" className="w-full" disabled={loading}>
                    <Spinner status={loading}> {t('common.create')} </Spinner>
                </PButton>
                <SCTALink to={-1} className="w-full"> {t('common.cancel')} </SCTALink>
            </div>
        </form>
    )
}