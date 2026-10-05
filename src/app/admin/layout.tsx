import { cookies } from "next/headers";
import { AdminNav } from "@/components/admin-nav";
import { ownerCookie } from "@/lib/admin";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const signedIn = Boolean(
    jar.get(ownerCookie)?.value || jar.get("rb_account")?.value,
  );
  return (
    <>
      {signedIn && (
        <header className="owner-header">
          <div className="wrap">
            <AdminNav />
          </div>
        </header>
      )}
      {children}
    </>
  );
}
