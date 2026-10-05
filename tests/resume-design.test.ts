import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultDesign, designSchema } from "../src/lib/resume-design/model";
import { designPreview } from "../src/lib/resume-design/preview";
import { designStyle } from "../src/components/resume-design-frame";
import { ResumeRenderer } from "../src/components/resume-renderer";
import { presentationSettingsSchema } from "../src/lib/markets";
import { readAsset } from "../src/lib/resume-design/uploads";
describe("bounded deterministic resume design", () => {
  it("rejects code, URLs, CSS injection, arbitrary fonts and out-of-bounds geometry", () => {
    for (const value of [
      { ...defaultDesign, accent: "red; background:url(https://bad.invalid)" },
      { ...defaultDesign, font: "url(https://bad.invalid)" },
      { ...defaultDesign, margin_mm: 0 },
      { ...defaultDesign, font_pt: 200 },
      { ...defaultDesign, script: "alert(1)" },
    ])
      expect(designSchema.safeParse(value).success).toBe(false);
    expect(() =>
      designStyle({ ...defaultDesign, accent: "</style><script>" }),
    ).toThrow();
  });
  it("renders the same facts consistently across template styles and never emits internal evidence IDs", () => {
    const ir = {
      ...designPreview,
      experiences: [
        {
          ...designPreview.experiences[0],
          title: '<script>alert("injection")</script>',
          evidence_ids: ["private-evidence-id"],
        },
      ],
    };
    for (const spec of [
      defaultDesign,
      {
        ...defaultDesign,
        layout: "SIDEBAR" as const,
        font: "SERIF" as const,
        photo: "CIRCLE" as const,
      },
    ]) {
      const html = renderToStaticMarkup(
        createElement(ResumeRenderer, { ir, design: spec }),
      );
      expect(html).toBe(
        renderToStaticMarkup(
          createElement(ResumeRenderer, { ir, design: spec }),
        ),
      );
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("private-evidence-id");
      expect(html).toContain("Fictional layout sample");
      expect(html).not.toContain("<script>alert");
    }
  });
  it("allows own image paths/HTTPS contact images but rejects executable and credential URLs", () => {
    const settings = {
      market: "US",
      location: "",
      address: "",
      contact_email: "",
      phone: "",
      work_authorization: "",
      photo_url: "/assets/77777777-7777-4777-8777-777777777777",
      is_public: false,
      version: 0,
    };
    expect(presentationSettingsSchema.safeParse(settings).success).toBe(true);
    for (const photo_url of [
      "javascript:alert(1)",
      "data:image/svg+xml,script",
      "https://user:secret@example.invalid/a.jpg",
    ])
      expect(
        presentationSettingsSchema.safeParse({ ...settings, photo_url })
          .success,
      ).toBe(false);
  });
  it("bounds streaming upload bytes, identifies actual file signatures and rejects PDFs as portraits", async () => {
    const pdf = new Request("http://localhost:3000", {
      method: "POST",
      body: "%PDF-1.7\nsynthetic upload test",
    });
    expect((await readAsset(pdf, true)).mime).toBe("application/pdf");
    await expect(
      readAsset(
        new Request("http://localhost", {
          method: "POST",
          body: "%PDF-1.7\nsynthetic",
        }),
        false,
      ),
    ).rejects.toThrow("portrait");
    await expect(
      readAsset(
        new Request("http://localhost", {
          method: "POST",
          body: "<script>fake image</script>",
        }),
        true,
      ),
    ).rejects.toThrow("PNG");
    await expect(
      readAsset(
        new Request("http://localhost", {
          method: "POST",
          body: new Uint8Array(4 * 1024 * 1024 + 1),
        }),
        true,
      ),
    ).rejects.toThrow("4 MB");
  });
});
