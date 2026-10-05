import { cookies } from "next/headers";
import { NewPasswordForm } from "@/components/password-recovery";
import {
  recoveryAccessCookie,
  recoveryRefreshCookie,
} from "@/lib/password-recovery";
export const dynamic = "force-dynamic";
export const metadata = {
  referrer: "no-referrer" as const,
  robots: { index: false, follow: false },
};
export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const jar = await cookies();
  const ready =
    !(await searchParams).error &&
    Boolean(
      jar.get(recoveryAccessCookie)?.value &&
      jar.get(recoveryRefreshCookie)?.value,
    );
  return (
    <main className="wrap prose">
      <NewPasswordForm ready={ready} />
    </main>
  );
}
