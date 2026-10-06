const uuid = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
const citation = new RegExp(
  `[\\[(](?:\\s*(?:sources?|evidence|packets?)\\s*:?\\s*)?${uuid}(?:\\s*[,;]\\s*${uuid})*\\s*[\\])]`,
  "gi",
);

/** Citation IDs remain in structured evidence metadata, not reader-facing prose. */
export function answerDisplay(text: string) {
  return text
    .replace(citation, "")
    .replace(new RegExp(uuid, "gi"), "")
    .replace(/[^\S\n]+([.,;:!?])/g, "$1")
    .replace(/[^\S\n]+$/gm, "")
    .trim();
}
