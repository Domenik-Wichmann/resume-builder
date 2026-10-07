import { NextResponse } from "next/server";
// A public visitor cannot override the market selected by a verified application link.
export async function POST() {
  return NextResponse.json(
    { error: "Profile presentation is selected automatically." },
    { status: 405, headers: { "Cache-Control": "no-store" } },
  );
}
