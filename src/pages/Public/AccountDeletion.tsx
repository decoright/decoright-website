import { useState, type FormEvent, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { companyNameTitle, supportMailAddress, phoneNumber } from "@/constants/company";
import { supabase } from "@/lib/supabase";
import { EmailInput, TextArea } from "@components/ui/Input";
import { PButton } from "@components/ui/Button";
import { Trash, Envelope, Phone, CheckCircle, ExclamationTriangle } from "@/icons";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function AccountDeletion() {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language?.startsWith("ar");
    const dir = isArabic ? "rtl" : "ltr";

    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [emailError, setEmailError] = useState<string | null>(null);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const appSteps = ["1", "2", "3", "4"].map((n) =>
        t(`account_deletion.method_app_steps.${n}`)
    );

    const deletedItems = ["profile", "messages", "requests", "files"].map((k) =>
        t(`account_deletion.data_deleted.${k}`)
    );

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setGlobalError(null);

        const trimmed = email.trim();
        if (!trimmed) {
            setEmailError(t("account_deletion.form_error_email_required"));
            return;
        }
        if (!EMAIL_RE.test(trimmed)) {
            setEmailError(t("account_deletion.form_error_email_invalid"));
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from("deletion_requests")
                .insert({ email: trimmed, message: message.trim() || null });

            if (error) throw error;
            setSubmitted(true);
        } catch (err) {
            console.error("Failed to submit deletion request:", err);
            setGlobalError(t("account_deletion.form_error_generic"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main dir={dir}>
            <section className="content-container relative w-full px-4 sm:px-8 md:px-12 pt-12 mt-20 mb-16 max-w-3xl mx-auto">

                {/* Heading */}
                <div className="flex flex-col gap-3 mb-10">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center size-11 rounded-xl bg-danger/10 text-danger shrink-0">
                            <Trash className="size-5" />
                        </span>
                        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                            {t("account_deletion.title")}
                        </h1>
                    </div>
                    <p className="text-sm md:text-base text-muted leading-7">
                        {t("account_deletion.intro", { company: companyNameTitle })}
                    </p>
                </div>

                {/* Option 1 — delete in app */}
                <div className="flex flex-col gap-4 p-5 md:p-6 bg-surface border border-muted/15 rounded-2xl mb-6">
                    <h2 className="text-lg md:text-xl font-semibold text-foreground">
                        {t("account_deletion.method_app_title")}
                    </h2>
                    <ol className="flex flex-col gap-3">
                        {appSteps.map((step, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <span className="flex items-center justify-center size-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                    {i + 1}
                                </span>
                                <span className="text-sm md:text-base text-muted leading-7">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Option 2 — web request form */}
                <div className="flex flex-col gap-4 p-5 md:p-6 bg-surface border border-muted/15 rounded-2xl mb-6">
                    <h2 className="text-lg md:text-xl font-semibold text-foreground">
                        {t("account_deletion.form_title")}
                    </h2>

                    {submitted ? (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                            <CheckCircle className="size-5 text-primary shrink-0 mt-0.5" />
                            <div className="flex flex-col gap-1">
                                <p className="text-sm font-medium text-foreground">
                                    {t("account_deletion.form_success_title")}
                                </p>
                                <p className="text-sm text-muted leading-7">
                                    {t("account_deletion.form_success_desc")}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                            <p className="text-sm md:text-base text-muted leading-7">
                                {t("account_deletion.form_desc")}
                            </p>

                            {globalError && (
                                <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                                    {globalError}
                                </p>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="deletion-email" className="text-xs text-muted px-1">
                                    {t("account_deletion.form_email_label")}
                                </label>
                                <EmailInput
                                    id="deletion-email"
                                    dir="ltr"
                                    value={email}
                                    error={emailError ?? undefined}
                                    onChange={(ev: ChangeEvent<HTMLInputElement>) => {
                                        setEmail(ev.target.value);
                                        setEmailError(null);
                                    }}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="deletion-message" className="text-xs text-muted px-1">
                                    {t("account_deletion.form_message_label")}
                                </label>
                                <TextArea
                                    id="deletion-message"
                                    rows={4}
                                    maxLength={1000}
                                    placeholder={t("account_deletion.form_message_placeholder")}
                                    value={message}
                                    onChange={(ev: ChangeEvent<HTMLTextAreaElement>) => setMessage(ev.target.value)}
                                />
                            </div>

                            <PButton type="submit" loading={submitting} className="w-full sm:w-auto px-8 py-3 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <Trash className="size-4" />
                                    {t("account_deletion.form_submit")}
                                </div>
                            </PButton>
                        </form>
                    )}
                </div>

                {/* What gets deleted */}
                <div className="flex flex-col gap-4 mb-6">
                    <h2 className="text-lg md:text-xl font-semibold text-foreground">
                        {t("account_deletion.data_deleted_title")}
                    </h2>
                    <p className="text-sm md:text-base text-muted leading-7">
                        {t("account_deletion.data_deleted_intro")}
                    </p>
                    <ul className="flex flex-col gap-2.5">
                        {deletedItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <CheckCircle className="size-5 text-primary shrink-0 mt-0.5" />
                                <span className="text-sm md:text-base text-muted leading-7">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Retention */}
                <div className="flex items-start gap-3 p-5 md:p-6 bg-emphasis/40 border border-muted/15 rounded-2xl mb-6">
                    <ExclamationTriangle className="size-5 text-muted shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-2">
                        <h3 className="text-base font-semibold text-foreground">
                            {t("account_deletion.data_retained_title")}
                        </h3>
                        <p className="text-sm text-muted leading-7">
                            {t("account_deletion.data_retained_desc")}
                        </p>
                        <p className="text-sm text-muted leading-7">
                            {t("account_deletion.processing_time")}
                        </p>
                    </div>
                </div>

                {/* Contact */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-lg md:text-xl font-semibold text-foreground">
                        {t("account_deletion.contact_title")}
                    </h2>
                    <p className="text-sm md:text-base text-muted leading-7">
                        {t("account_deletion.contact_desc")}
                    </p>
                    <div className="flex flex-col gap-2">
                        <a
                            href={`mailto:${supportMailAddress}`}
                            dir="ltr"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:underline w-fit"
                        >
                            <Envelope className="size-4" />
                            {supportMailAddress}
                        </a>
                        <a
                            href={`tel:${phoneNumber}`}
                            dir="ltr"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:underline w-fit"
                        >
                            <Phone className="size-4" />
                            {phoneNumber}
                        </a>
                    </div>
                </div>

            </section>
        </main>
    );
}
