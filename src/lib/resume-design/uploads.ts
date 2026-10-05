import "server-only";
import { HttpError } from "../http";
import { imageType } from "../portfolio/images";
export const assetLimit = 4 * 1024 * 1024;
export async function readAsset(request: Request, pdfAllowed: boolean) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Choose a file.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > assetLimit) {
      await reader.cancel();
      throw new HttpError(413, "File limit is 4 MB.");
    }
    chunks.push(next.value);
  }
  const bytes = Buffer.concat(chunks);
  const type =
    imageType(bytes) ||
    (pdfAllowed && bytes.subarray(0, 5).toString("ascii") === "%PDF-"
      ? { mime: "application/pdf", extension: "pdf" }
      : null);
  if (!type)
    throw new HttpError(
      415,
      pdfAllowed
        ? "Use a PNG, JPEG, WebP, GIF or PDF."
        : "Use a PNG, JPEG, WebP or GIF portrait.",
    );
  return { bytes, ...type };
}
