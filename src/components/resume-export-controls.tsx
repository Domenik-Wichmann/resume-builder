"use client";
import { useRef, useState } from "react";
import type { ResumeIR } from "@/lib/resume-ir";
import { defaultDesign } from "@/lib/resume-design/model";
import { wordDocument } from "@/lib/resume-export";

function download(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
export function ResumeExportControls({
  ir,
  filename,
  preview = false,
}: {
  ir: ResumeIR;
  filename?: string;
  preview?: boolean;
}) {
  const [format, setFormat] = useState("pdf");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const name = (filename || `${ir.profile.name}-resume`)
    .replace(/[^\p{L}\p{N}_-]/gu, "-")
    .slice(0, 160);
  const source = () =>
    container.current?.parentElement?.querySelector<HTMLElement>(
      ".resume-design",
    ) || document.querySelector<HTMLElement>(".resume-design");
  async function printPreview() {
    setError("");
    const documentNode = source();
    if (!documentNode) {
      setError("The résumé preview is not ready.");
      return;
    }
    const frame = document.createElement("iframe");
    frame.title = "Résumé print preview";
    frame.style.cssText =
      "position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0";
    document.body.append(frame);
    const page = frame.contentDocument;
    if (!page || !frame.contentWindow) {
      frame.remove();
      setError("Print preview could not be opened.");
      return;
    }
    page.open();
    page.write("<!DOCTYPE html><html><head></head><body></body></html>");
    page.close();
    page.title = name;
    for (const style of document.querySelectorAll(
      'link[rel="stylesheet"], style',
    ))
      page.head.append(style.cloneNode(true));
    page.body.append(documentNode.cloneNode(true));
    await Promise.all(
      Array.from(
        page.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      ).map((style) =>
        style.sheet
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              style.onload = () => resolve();
              style.onerror = () => resolve();
            }),
      ),
    );
    await page.fonts.ready;
    await Promise.all(
      Array.from(page.images).map((image) =>
        image.decode().catch(() => undefined),
      ),
    );
    frame.contentWindow.addEventListener("afterprint", () => frame.remove(), {
      once: true,
    });
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }
  async function save() {
    setBusy(true);
    setError("");
    let url: string | undefined;
    try {
      if (format === "doc") {
        url = URL.createObjectURL(
          new Blob([wordDocument(ir)], {
            type: "application/msword;charset=utf-8",
          }),
        );
      } else if (format === "pdf") {
        const { resumePdf } = await import("@/lib/resume-export-pdf");
        url = URL.createObjectURL(await resumePdf(ir));
      } else {
        const original = source();
        if (!original) throw new Error("The résumé preview is not ready.");
        const node = original.cloneNode(true) as HTMLElement;
        const design = ir.design || defaultDesign;
        node.style.cssText += `;position:fixed;left:-10000px;top:0;width:${design.page === "LETTER" ? 816 : 794}px;max-width:none`;
        document.body.append(node);
        try {
          await document.fonts.ready;
          const { toPng, toJpeg } = await import("html-to-image");
          const options = {
            pixelRatio: 2,
            backgroundColor: design.background || "#FFFFFF",
            quality: 0.95,
            style: { position: "static", left: "auto", top: "auto" },
          };
          url =
            format === "png"
              ? await toPng(node, options)
              : await toJpeg(node, options);
        } finally {
          node.remove();
        }
      }
      download(url, `${name}.${format}`);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Download failed. Try again.",
      );
    } finally {
      if (url?.startsWith("blob:"))
        setTimeout(() => URL.revokeObjectURL(url!), 30000);
      setBusy(false);
    }
  }
  return (
    <div className="resume-export-controls" ref={container}>
      <div className="resume-export-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void printPreview().catch(() =>
              setError("Print preview could not be opened. Try again."),
            )
          }
        >
          Print preview
        </button>
        <label>
          Download format
          <select
            value={format}
            disabled={busy}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="pdf">PDF</option>
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="doc">DOC (Word-compatible)</option>
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Preparing download…" : `Download ${format.toUpperCase()}`}
        </button>
      </div>
      {preview && (
        <p className="muted">
          Draft download: save this résumé to finalize its tracking link.
        </p>
      )}
      <p className="muted">
        PDF uses a text layout. Print preview preserves the displayed layout;
        PNG and JPG capture the full résumé. DOC opens in Word.
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
