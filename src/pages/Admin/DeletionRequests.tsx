import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Table from "@/components/ui/DataTable";
import { DeletionRequestService, type DeletionRequest } from "@/services/deletion-request.service";
import { useConfirm } from "@/components/confirm";
import { getUserFriendlyError } from "@/utils/error-messages";
import { Calendar, Envelope, CheckCircle, ArrowPath, Trash } from "@/icons";

function StatusBadge({ status, label }: { status: string; label: string }) {
    const done = status === "done";
    return (
        <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full ${
                done ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            }`}
        >
            <span className={`size-1.5 rounded-full ${done ? "bg-success" : "bg-warning"}`} />
            {label}
        </span>
    );
}

export default function DeletionRequestsPage() {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [requests, setRequests] = useState<DeletionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await DeletionRequestService.getAll();
            setRequests(data);
            setError(null);
        } catch (err) {
            setError(getUserFriendlyError(err, t));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleToggleStatus = async (row: DeletionRequest) => {
        const next = row.status === "done" ? "pending" : "done";
        try {
            await DeletionRequestService.updateStatus(row.id, next);
            setRequests((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
            toast.success(t("admin.deletion_requests.status_updated"));
        } catch (err) {
            toast.error(getUserFriendlyError(err, t));
        }
    };

    const handleDelete = async (row: DeletionRequest) => {
        const isConfirmed = await confirm({
            title: t("admin.deletion_requests.delete_title"),
            message: t("admin.deletion_requests.delete_message", { email: row.email }),
            confirmText: t("common.delete"),
            cancelText: t("common.cancel"),
            isDangerous: true,
        });
        if (!isConfirmed) return;

        try {
            await DeletionRequestService.remove(row.id);
            setRequests((prev) => prev.filter((r) => r.id !== row.id));
            toast.success(t("admin.deletion_requests.deleted"));
        } catch (err) {
            toast.error(getUserFriendlyError(err, t));
        }
    };

    const columns = [
        {
            key: "created_at",
            title: t("admin.deletion_requests.col_date"),
            className: "min-w-[150px]",
            render: (row: DeletionRequest) => (
                <div className="flex items-center gap-2 text-xs text-muted whitespace-nowrap">
                    <Calendar className="size-3.5 shrink-0" />
                    {format(new Date(row.created_at), "MMM d, yyyy HH:mm")}
                </div>
            ),
        },
        {
            key: "email",
            title: t("admin.deletion_requests.col_email"),
            searchable: true,
            className: "min-w-[200px]",
            render: (row: DeletionRequest) => (
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-emphasis flex items-center justify-center shrink-0">
                        <Envelope className="size-4 text-muted" />
                    </div>
                    <a href={`mailto:${row.email}`} dir="ltr" className="text-xs font-medium text-heading hover:text-primary hover:underline">
                        {row.email}
                    </a>
                </div>
            ),
        },
        {
            key: "message",
            title: t("admin.deletion_requests.col_message"),
            searchable: true,
            className: "min-w-[220px] max-w-[360px]",
            render: (row: DeletionRequest) =>
                row.message ? (
                    <p className="text-xs text-muted whitespace-pre-wrap break-words line-clamp-3">{row.message}</p>
                ) : (
                    <span className="text-xs text-muted/50 italic">{t("admin.deletion_requests.no_message")}</span>
                ),
        },
        {
            key: "status",
            title: t("admin.deletion_requests.col_status"),
            className: "min-w-[110px]",
            render: (row: DeletionRequest) => (
                <StatusBadge
                    status={row.status}
                    label={row.status === "done"
                        ? t("admin.deletion_requests.status_done")
                        : t("admin.deletion_requests.status_pending")}
                />
            ),
        },
    ];

    const renderActions = (row: DeletionRequest) => (
        <div className="flex flex-col gap-1 min-w-44">
            <button
                onClick={() => handleToggleStatus(row)}
                className="inline-flex items-center gap-2 w-full p-2 text-sm text-body hover:bg-emphasis hover:text-heading rounded"
            >
                {row.status === "done" ? <ArrowPath className="size-4" /> : <CheckCircle className="size-4 text-success" />}
                {row.status === "done"
                    ? t("admin.deletion_requests.action_mark_pending")
                    : t("admin.deletion_requests.action_mark_done")}
            </button>
            <button
                onClick={() => handleDelete(row)}
                className="inline-flex items-center gap-2 w-full p-2 text-sm text-danger hover:bg-danger/10 rounded"
            >
                <Trash className="size-4" />
                {t("common.delete")}
            </button>
        </div>
    );

    return (
        <div className="w-full">
            <section className="flex flex-col pt-4 md:pt-6 w-full h-full mb-40">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex flex-col gap-1">
                        <h1 className="font-medium text-xl md:text-2xl text-heading tracking-tight">
                            {t("admin.deletion_requests.title")}
                        </h1>
                        <p className="text-sm text-muted">{t("admin.deletion_requests.subtitle")}</p>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm mb-4">
                        {error}
                    </div>
                )}

                {loading && requests.length === 0 ? (
                    <div className="p-10 text-center text-muted animate-pulse">{t("admin.deletion_requests.loading")}</div>
                ) : (
                    <Table
                        columns={columns}
                        data={requests}
                        options={{
                            searchPlaceholder: t("admin.deletion_requests.search_placeholder"),
                            onRefresh: fetchRequests,
                            renderActions,
                            filterOptions: [
                                { label: t("admin.deletion_requests.status_pending"), value: "pending" },
                                { label: t("admin.deletion_requests.status_done"), value: "done" },
                            ],
                            filterField: "status",
                            noResults: (
                                <div className="py-12 text-center text-muted text-sm italic">
                                    {t("admin.deletion_requests.no_results")}
                                </div>
                            ),
                        }}
                        className="border-0 rounded-none shadow-none"
                    />
                )}
            </section>
        </div>
    );
}
