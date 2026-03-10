
import type { TFunction } from "i18next";

/**
 * Maps Supabase Auth errors to user-friendly, localized messages.
 * @param error The error object from Supabase Auth
 * @param t The translation function from useTranslation()
 * @returns A localized error message string
 */
export function getAuthErrorMessage(error: any, t: TFunction): string {
    if (!error) return "";

    const message = error.message?.toLowerCase() || "";
    const status = error.status;

    // 1. Handle by message content (most common for Supabase)
    if (message.includes("invalid login credentials")) {
        return t("auth.errors.invalid_credentials");
    }

    if (message.includes("email not confirmed")) {
        return t("auth.errors.email_not_confirmed");
    }

    if (message.includes("user already registered") || message.includes("user already exists")) {
        return t("auth.error_email_taken");
    }

    if (message.includes("password") && (message.includes("weak") || message.includes("should be at least"))) {
        return t("auth.error_weak_password");
    }

    if (message.includes("rate limit")) {
        return t("auth.errors.rate_limit");
    }

    if (message.includes("link is invalid") || message.includes("expired")) {
        return t("auth.errors.link_expired");
    }

    if (message.includes("different from the old password")) {
        return t("password.error_same_password");
    }

    if (message.includes("user not found")) {
        return t("auth.errors.user_not_found");
    }

    if (message.includes("otp") || message.includes("token")) {
        return t("auth.otp.error_invalid");
    }

    // 2. Handle by status code as fallback
    if (status === 429) {
        return t("auth.errors.rate_limit");
    }

    // 3. Default fallback
    return error.message || t("auth.errors.generic");
}
