import { PortfolioHeader } from "@/components/portfolio-shell";
import { CareerExplorer } from "@/components/career-explorer";
import { getExplorer } from "@/lib/portfolio/explorer-server";
export const dynamic = "force-dynamic";
export const metadata = { title: "Career explorer · Resume Builder" };
export default async function Explore() {
  const data = await getExplorer();
  return (
    <>
      {data.demo && (
        <div className="demo-banner">
          DEMO EXPLORER · fictional fixture data, not owner career evidence.
        </div>
      )}
      <PortfolioHeader />
      <main className="wrap portfolio-main">
        <p className="eyebrow">Skills connected to work</p>
        <h1>Follow the evidence.</h1>
        <p className="lead">
          Select a skill to see the projects, experiences and achievements
          behind it.
        </p>
        <CareerExplorer data={data} />
      </main>
    </>
  );
}
