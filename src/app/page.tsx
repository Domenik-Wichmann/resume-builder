import Link from "next/link";
import { CareerChat } from "@/components/career-chat";
import { PortfolioStoryHero } from "@/components/portfolio-story";
import { currentMarket, getPresentation } from "@/lib/market-server";
import { publicResumeDesign } from "@/lib/resume-design/server";
import { getPortfolioStory } from "@/lib/portfolio/story-server";
import "./portfolio-story.css";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [story, design, presentation] = await Promise.all([
    getPortfolioStory(),
    publicResumeDesign(),
    currentMarket().then(getPresentation),
  ]);
  return (
    <div className="public-experience">
      <main id="main">
        <PortfolioStoryHero story={story} presentation={presentation} />
        <CareerChat design={design} />
      </main>
      <footer className="wrap footer">
        <span>Career, connected.</span>
        <Link href="/privacy">Privacy & data</Link>
      </footer>
    </div>
  );
}
