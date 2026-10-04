import { AccountLogin } from "@/components/account-login";
export const dynamic = "force-dynamic";
export default function Login() {
  return (
    <main className="wrap prose">
      <AccountLogin
        google={process.env.AUTH_GOOGLE_ENABLED === "true"}
        github={process.env.AUTH_GITHUB_ENABLED === "true"}
      />
    </main>
  );
}
