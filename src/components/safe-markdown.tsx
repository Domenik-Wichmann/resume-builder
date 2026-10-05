import type { ReactNode } from "react";
// React escapes all text. Links and raw HTML remain inert text, including inside emphasis.
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : part.startsWith("`") && part.endsWith("`") ? (
        <code key={index}>{part.slice(1, -1)}</code>
      ) : (
        part
      ),
    );
}
export function SafeMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push(
        heading[1].length <= 2 ? (
          <h3 key={index}>{inline(heading[2])}</h3>
        ) : (
          <h4 key={index}>{inline(heading[2])}</h4>
        ),
      );
      index++;
      continue;
    }
    const ordered = /^\d+[.)]\s+/.test(line);
    if (ordered || /^[-*]\s+/.test(line)) {
      const start = index;
      const items: ReactNode[] = [];
      const pattern = ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/;
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(
          <li key={index}>{inline(lines[index].replace(pattern, ""))}</li>,
        );
        index++;
      }
      blocks.push(
        ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>,
      );
      continue;
    }
    const start = index;
    const paragraph = [line];
    index++;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6}\s|[-*]\s|\d+[.)]\s)/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index++;
    }
    blocks.push(
      <p key={start} style={{ whiteSpace: "pre-line" }}>
        {inline(paragraph.join("\n"))}
      </p>,
    );
  }
  return <div className="rich-description">{blocks}</div>;
}
