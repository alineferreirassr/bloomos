import { ResetPasswordForm } from "./ResetPasswordForm";

const INVALID_LINK_ERROR = "This password reset link is invalid or has expired. Enter your email to request a new one.";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <ResetPasswordForm initialError={error === "invalid_link" ? INVALID_LINK_ERROR : undefined} />;
}
