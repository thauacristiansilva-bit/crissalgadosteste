import {
  PasswordResetForm,
} from "@/components/auth/password-reset-form"

export const dynamic =
  "force-dynamic"

export default async function PasswordResetPage({
  params,
}: {
  params: Promise<{
    token: string
  }>
}) {
  const { token } =
    await params

  return (
    <PasswordResetForm
      token={decodeURIComponent(
        token,
      )}
    />
  )
}
