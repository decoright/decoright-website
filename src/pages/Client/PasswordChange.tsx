import Spinner from "@/components/common/Spinner";
import { PButton } from "@/components/ui/Button";
import { SCTALink } from "@/components/ui/CTA";
import { PasswordInput } from "@/components/ui/Input";
import { PASSWORD_REGEX } from "@/utils/validators";
import { supabase } from "@/lib/supabase";
import { PATHS } from "@/routers/Paths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getAuthErrorMessage } from "@/utils/auth-errors";

export default function PasswordChange () {

    const navigate = useNavigate()
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [newPasswordValid, setNewPasswordValid] = useState(false);
    const [newPasswordsMatch, setNewPasswordsMatch] = useState(false);

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { t } = useTranslation()

    // Validate length + no whitespace
    useEffect(() => {
        setNewPasswordValid(PASSWORD_REGEX.test(newPassword));
    }, [newPassword]);

    // Check password match
    useEffect(() => {
        setNewPasswordsMatch(newPassword !== "" && newPassword === confirmPassword);
    }, [newPassword, confirmPassword]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        setError(null);

        if(!newPasswordValid || !newPasswordsMatch) {
            setError(t('password.error_invalid_match'))
            return;
        }

        setLoading(true);
        try {
            const {
                data: { user: currentUser },
                error: getUserError,
            } = await supabase.auth.getUser();

            if (getUserError) {
                console.error("getUser error", getUserError);
                setError(t('password.change_error_session'));
                return;
            }

            if (!currentUser?.email) {
                setError(t('password.change_error_no_user'));
                return;
            }

            const email = currentUser.email;

            // re-authenticate: try sign-in with email + current password.
            // If password is wrong, supabase will return an error.
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            });

            if (signInError) {
                // Common reasons: wrong password, user disabled, etc.
                // Do not be verbose about which one for security; a simple message is fine.
                setError(t('password.change_error_current_wrong'));
                return;
            }

            // Optional safety check: ensure the reauth returned the same user id
            if (signInData?.user && signInData.user.id !== currentUser.id) {
                // Extremely unlikely, but check anyway
                console.warn("Re-authenticated user id mismatch", { original: currentUser.id, reauth: signInData.user.id });
                setError(t('password.change_error_auth_mismatch'));
                return;
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
                // User data updated at ?
                }
            )

            if (updateError) {
                console.error("Password update failed", updateError);
                setError(getAuthErrorMessage(updateError, t));
                return;
            }

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            navigate(PATHS.CLIENT.PASSWORD_DONE)
        } catch (err: any) {
            console.error("Unhandled error in password change", err);
            setError( t('errors.generic') );
        } finally {
            setLoading(false)
        }
    }

    return (

        <main>
            <section className="h-hero min-h-hero max-w-180 mx-auto relative flex flex-col items-center justify-center w-full mt-8">

                <div className="absolute right-full w-full h-[calc(100svh-24rem)] md:h-[calc(100svh-22rem)] border border-muted/20 rounded-4xl mask-l-to-transparent mask-l-to-30% overflow-hidden"></div>

                <div className="relative flex flex-col justify-center gap-8 w-full h-full px-2 sm:px-8 md:px-16 p-4 md:py-8">
                    <div className="absolute top-0 left-0 w-full h-full border border-muted/15 rounded-4xl bg-surface/75 -z-10 mask-b-to-transparent mask-b-to-100%"></div>

                    <div className="flex flex-col items-center w-full mb-8">
                        <div className="w-1/3">
                            {/* <img src={HeroImg} alt="" className="w-full h-full" /> */}
                        </div>

                        <div className="space-y-2 text-center">
                            <h1 className="font-semibold text-xl md:text-3xl"> { t('password.change_title') } </h1>
                            <p className="text-xs md:text-sm"> { t('password.change_description') } </p>
                        </div>
                    </div>

                    {error && <p className="text-xs text-danger text-center"> {error} </p>}

                    <form onSubmit={handleSubmit} id="password-change-form">
                        <div>
                            <label htmlFor="current-password"
                            className="font-medium text-xs text-muted"
                            > { t('password.password_current_label') } </label>
                            <PasswordInput id="current-password" onChange={(e:React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="new-password"
                            className="font-medium text-xs text-muted"
                            > { t('password.password_new_label') } </label>
                            <PasswordInput id="new-password" onChange={(e:React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="new-password2"
                            className="font-medium text-xs text-muted"
                            > { t('password.password_confirm_new_label') } </label>
                            <PasswordInput id="new-password2" onChange={(e:React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)} />
                        </div>

                        {/* CTA */}
                        <div className="flex max-xs:flex-col md:flex-row gap-3 md:gap-4 w-full md:w-fit mt-4">
                            <PButton type="submit" form="password-change-form"
                            className="w-full h-fit"
                            disabled={!currentPassword || !newPassword || !confirmPassword || loading}
                            title="Submit request"
                            >
                                <Spinner status={loading}> { t('password.password_change_cta') } </Spinner>
                            </PButton>
                            <SCTALink to={-1} className="w-full"> { t('common.cancel') } </SCTALink>
                        </div>
                    </form>

                </div>

                <div className="absolute left-full w-full h-[calc(100svh-24rem)] md:h-[calc(100svh-22rem)] border border-muted/20 rounded-4xl mask-r-to-transparent mask-r-to-30% overflow-hidden" />
            </section>
        </main>

    )
}
