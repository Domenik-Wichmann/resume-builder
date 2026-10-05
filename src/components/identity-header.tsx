import Link from "next/link";
import Image from "next/image";
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
          {presentation.photo_url ? (
            <Image
              src={presentation.photo_url}
              width={48}
              height={48}
              unoptimized
              className="avatar-photo"
              alt={`Portrait of ${career.profile.name}`}
            />
          ) : (
            <span className="avatar" aria-label="Photo placeholder">
              {career.profile.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </span>
          )}
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
          <Link href="/#work">Work</Link>
          <Link href="/workspace">Workspaces</Link>
        </div>
      </div>
    </header>
  );
}
