import { AccountLogin } from "@/components/account-login";
export const dynamic = "force-dynamic";
import Link from "next/link";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main id="main" className="wrap admin-sign-in">
      <Link href="/">← Back to portfolio</Link>
      <AccountLogin
        next={next}
        google={process.env.AUTH_GOOGLE_ENABLED === "true"}
        github={process.env.AUTH_GITHUB_ENABLED === "true"}
      />
    </main>
  );
}
