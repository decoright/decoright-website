import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { PATHS } from "@/routers/Paths";
import { LegalService } from "@/services/legal.service";
import Spinner from "@/components/common/Spinner";
import { ArrowLeft } from "@/icons";

type FormData = {
    title_en: string;
    title_ar: string;
    title_fr: string;
    content_en: string;
    content_ar: string;
    content_fr: string;
};

export default function LegalUpdate() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pageInfo, setPageInfo] = useState<{ slug: string } | null>(null);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

    useEffect(() => {
        async function fetchPage() {
            if (!id) return;
            try {
                setLoading(true);
                const data = await LegalService.getPageById(id);
                if (data) {
                    reset({
                        title_en: data.title_en,
                        title_ar: data.title_ar,
                        title_fr: data.title_fr,
                        content_en: data.content_en,
                        content_ar: data.content_ar,
                        content_fr: data.content_fr,
                    });
                    setPageInfo({ slug: data.slug });
                }
            } catch (error) {
                console.error("Failed to fetch legal page:", error);
                toast.error("Failed to load page");
            } finally {
                setLoading(false);
            }
        }
        fetchPage();
    }, [id, reset]);

    const onSubmit = async (data: FormData) => {
        if (!id) return;
        try {
            setSaving(true);
            await LegalService.updatePage(id, data);
            toast.success("Page updated successfully");
            navigate(PATHS.ADMIN.LEGAL_LIST);
        } catch (error) {
            console.error("Failed to update legal page:", error);
            toast.error("Failed to update page");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Spinner status={true} size="lg" />
            </div>
        );
    }

    return (
        <main className="w-full h-full">
            <section className="flex flex-col pt-4 md:pt-6 w-full h-full">
                <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
                    <div className="flex items-center gap-4">
                        <Link to={PATHS.ADMIN.LEGAL_LIST} className="p-2 border border-muted/15 rounded-lg hover:bg-emphasis transition-colors">
                            <ArrowLeft className="size-4 text-muted" />
                        </Link>
                        <div className="flex flex-col gap-1">
                            <h1 className="font-medium text-2xl tracking-tight">Edit Legal Page</h1>
                            <p className="text-sm text-muted">Update content for /{pageInfo?.slug}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
                        <div className="flex flex-col gap-4 p-4 border border-muted/15 bg-surface rounded-xl">
                            <h2 className="font-semibold text-lg border-b border-muted/10 pb-2">English</h2>
                            
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Title</label>
                                <input
                                    {...register("title_en", { required: "English title is required" })}
                                    className="p-2 bg-emphasis border border-muted/15 rounded-lg"
                                />
                                {errors.title_en && <span className="text-xs text-red-500">{errors.title_en.message}</span>}
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Content</label>
                                <p className="text-xs text-muted">Supports Markdown formatting (headings, lists, links, tables).</p>
                                <textarea
                                    {...register("content_en", { required: "English content is required" })}
                                    className="p-2 bg-emphasis border border-muted/15 rounded-lg min-h-[200px]"
                                />
                                {errors.content_en && <span className="text-xs text-red-500">{errors.content_en.message}</span>}
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 p-4 border border-muted/15 bg-surface rounded-xl">
                            <h2 className="font-semibold text-lg border-b border-muted/10 pb-2">Arabic</h2>
                            
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Title</label>
                                <input
                                    {...register("title_ar")}
                                    dir="rtl"
                                    className="p-2 bg-emphasis border border-muted/15 rounded-lg text-right"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Content</label>
                                <p className="text-xs text-muted">Supports Markdown formatting (headings, lists, links, tables).</p>
                                <textarea
                                    {...register("content_ar")}
                                    dir="rtl"
                                    className="p-2 bg-emphasis border border-muted/15 rounded-lg min-h-[200px] text-right"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 p-4 border border-muted/15 bg-surface rounded-xl">
                            <h2 className="font-semibold text-lg border-b border-muted/10 pb-2">French</h2>
                            
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Title</label>
                                <input
                                    {...register("title_fr")}
                                    className="p-2 bg-emphasis border border-muted/15 rounded-lg"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium">Content</label>
                                <p className="text-xs text-muted">Supports Markdown formatting (headings, lists, links, tables).</p>
                                <textarea
                                    {...register("content_fr")}
                                    className="p-2 bg-emphasis border border-muted/15 rounded-lg min-h-[200px]"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Link to={PATHS.ADMIN.LEGAL_LIST} className="px-4 py-2 border border-muted/15 rounded-lg text-sm font-medium hover:bg-emphasis">
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </main>
    );
}
