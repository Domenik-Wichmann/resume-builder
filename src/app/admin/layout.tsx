import { AdminNav } from "@/components/admin-nav";
import { isOwner } from "@/lib/admin";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminSignInPath } from "@/lib/auth-navigation";
import { AdminSession } from "@/components/admin-session";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const signedIn = await isOwner();
  const preview = process.env.APP_MODE === "demo";
  let showNavigation = signedIn || preview;
  if (!signedIn && !preview) {
    try {
      // Existing account-scoped tools retain their verified membership access.
      // Owner-only pages and endpoints keep their separate exact-owner checks.
      await requireAccount();
      showNavigation = true;
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 403) throw error;
      redirect(adminSignInPath((await headers()).get("x-admin-path")));
    }
  }
  return (
    <div className="admin-shell">
      {showNavigation && (
        <header className="owner-header">
          <div className="wrap">
            <AdminNav />
          </div>
        </header>
      )}
      {signedIn && <AdminSession />}
      {children}
    </div>
  );
}
