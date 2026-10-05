import Link from "next/link";
import Image from "next/image";
import { CareerChat } from "@/components/career-chat";
import { getCareer } from "@/lib/career/repository";
import { currentMarket, getPresentation } from "@/lib/market-server";
export const dynamic = "force-dynamic";
export default async function Home() {
  const career = await getCareer();
  const presentation = await getPresentation(await currentMarket());
  return (
    <div className="public-experience">
      {career.demo && (
        <div className="demo-banner">
          DEMO PORTFOLIO{" "}
          <span>Fictional career data for exploring the experience.</span>
        </div>
      )}
      <header className="site-header wrap">
        <Link className="wordmark" href="/">
          career<span> / </span>connected.
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/explore">Explore</Link>
          <Link href="/workspace">Workspaces</Link>
          <a href="#ask">Let’s talk ↗</a>
        </nav>
      </header>
      <main id="main">
        <section className="profile-hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> The person behind the work
            </p>
            <h1 id="hero-title">
              {career.profile.name || "A story taking shape."}
              <span>
                {career.profile.title || "Career profile pending publication."}
              </span>
            </h1>
            <p className="hero-intro">{career.profile.introduction}</p>
            <div className="hero-actions">
              <Link className="text-link" href="/resume">
                View résumé ↗
              </Link>
            </div>
            <div className="hero-contact">
              {presentation.location && <span>{presentation.location}</span>}
              {presentation.address && <span>{presentation.address}</span>}
              {presentation.contact_email && (
                <a href={`mailto:${presentation.contact_email}`}>
                  {presentation.contact_email}
                </a>
              )}
              {presentation.phone && (
                <a href={`tel:${presentation.phone.replace(/[^+\d]/g, "")}`}>
                  {presentation.phone}
                </a>
              )}
              {presentation.work_authorization && (
                <span>{presentation.work_authorization}</span>
              )}
            </div>
          </div>
          <div className="hero-portrait">
            <div className="portrait-orbit" />
            <div className="portrait-frame">
              {presentation.photo_url ? (
                <Image
                  src={presentation.photo_url}
                  alt={career.profile.name || "Profile portrait"}
                  width={600}
                  height={720}
                  unoptimized
                  priority
                />
              ) : (
                <div
                  className="portrait-initials"
                  aria-label="Profile photo not yet added"
                >
                  <span>
                    {career.profile.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("") || "✧"}
                  </span>
                  <small>Portrait coming soon</small>
                </div>
              )}
            </div>
            <div className="portrait-caption">
              <span className="status-dot" />{" "}
              {career.demo
                ? "Fictional demo profile"
                : "Explore the experience"}
              <span>↗</span>
            </div>
          </div>
          <div className="hero-chat-action">
            <a className="button" href="#ask">
              Explore my career history <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>
        <CareerChat />
      </main>
      <footer className="wrap footer">
        <span>Career, connected.</span>
        <Link href="/privacy">Privacy & data</Link>
      </footer>
    </div>
  );
}
