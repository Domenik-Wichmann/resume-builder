import Link from "next/link";
import type { Career } from "@/lib/career/model";
import type { Presentation } from "@/lib/markets";

export function IdentityHeader({
  career,
  presentation,
}: {
  career: Career;
  presentation: Presentation;
}) {
  return (
    <header className="identity-header">
      <div className="wrap identity-content">
        <Link href="/" className="identity-person">
          <span className="avatar" aria-label="Photo placeholder">
            {career.profile.name
              .split(" ")
              .map((part) => part[0])
              .join("")}
          </span>
          <span>
            <strong>{career.profile.name}</strong>
            <small>{career.profile.title}</small>
            <small>
              {[
                presentation.location,
                presentation.address,
                presentation.contact_email,
                presentation.phone,
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </span>
        </Link>
        <div className="identity-nav">
          <Link href="/explore">Explore</Link>
          <Link href="/workspace">Workspaces</Link>
        </div>
      </div>
    </header>
  );
}
