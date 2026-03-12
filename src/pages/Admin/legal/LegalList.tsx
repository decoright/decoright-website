import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PATHS } from "@/routers/Paths";
import { LegalService, type LegalPage } from "@/services/legal.service";
import { PencilSquare } from "@/icons";
import Spinner from "@/components/common/Spinner";

export function LegalPageRow({ page }: { page: LegalPage }) {
    return (
        <li className="flex flex-col gap-3 p-4 border border-muted/15 bg-surface rounded-xl hover:border-primary/30 transition-all group">
            <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-tighter">
                            /{page.slug}
                        </span>
                    </div>
                    <h3 className="font-semibold text-sm">{page.title_en}</h3>
                    <p className="text-xs text-muted line-clamp-2">Last updated: {new Date(page.updated_at).toLocaleDateString()}</p>
                </div>

                <div className="flex items-center gap-1 transition-opacity">
                    <Link
                        to={PATHS.ADMIN.legalUpdate(page.id)}
                        className="p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="Edit Page"
                    >
                        <PencilSquare className="size-4" />
                    </Link>
                </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-muted/5">
                <span className="text-[10px] text-muted/60 bg-muted/5 px-1.5 py-0.5 rounded">EN</span>
                {page.title_ar && <span className="text-[10px] text-muted/60 bg-muted/5 px-1.5 py-0.5 rounded">AR</span>}
                {page.title_fr && <span className="text-[10px] text-muted/60 bg-muted/5 px-1.5 py-0.5 rounded">FR</span>}
            </div>
        </li>
    );
}

export default function LegalList() {
    const [pages, setPages] = useState<LegalPage[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPages = async () => {
        try {
            setLoading(true);
            const data = await LegalService.getAllPages();
            setPages(data);
        } catch (error) {
            console.error("Failed to fetch legal pages:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPages();
    }, []);

    return (
        <main className="w-full h-full">
            <section className="flex flex-col pt-4 md:pt-6 w-full h-full">
                <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <h1 className="font-medium text-2xl tracking-tight">Legal Pages</h1>
                            <p className="text-sm text-muted">Manage your website's terms, privacy policy, and other legal documents</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 w-full">
                        {loading ? (
                            <div className="flex items-center justify-center p-20">
                                <Spinner status={true} size="lg" />
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-4 w-full">
                                {pages.map((page) => (
                                    <LegalPageRow key={page.id} page={page} />
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
