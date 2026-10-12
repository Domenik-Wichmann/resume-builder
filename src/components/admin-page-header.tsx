import Link from "next/link";
export function AdminPageHeader({
  section,
  title,
  description,
  children,
}: {
  section: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="admin-page-heading">
      <div>
        <p className="admin-breadcrumb">
          <Link href="/admin">Overview</Link>
          <span aria-hidden="true">/</span>
          {section}
        </p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </header>
  );
}
