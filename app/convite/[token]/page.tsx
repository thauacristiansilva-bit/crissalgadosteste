import {
  InvitationAcceptance,
} from "@/components/auth/invitation-acceptance"

export const dynamic =
  "force-dynamic"

export default async function InvitationPage({
  params,
}: {
  params: Promise<{
    token: string
  }>
}) {
  const { token } =
    await params

  return (
    <InvitationAcceptance
      token={decodeURIComponent(
        token,
      )}
    />
  )
}
