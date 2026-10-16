import Link from "next/link";
import { HomeExperience } from "@/components/home-experience";
import { currentMarket, getPresentation } from "@/lib/market-server";
import { publicResumeDesign } from "@/lib/resume-design/server";
import { getPortfolioStory } from "@/lib/portfolio/story-server";
import "./portfolio-home.css";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [story, design, presentation] = await Promise.all([
    getPortfolioStory(),
    publicResumeDesign(),
    currentMarket().then(getPresentation),
  ]);
  return (
    <div className="public-experience portfolio-home">
      <main id="main">
        <HomeExperience
          story={{
            profile: story.profile,
            highlights: story.highlights,
            demo: story.demo,
          }}
          presentation={presentation}
          design={design}
        />
      </main>
      <footer className="wrap footer">
        <span>Domenik Wichmann</span>
        <Link href="/privacy">Privacy & data</Link>
      </footer>
    </div>
  );
}
