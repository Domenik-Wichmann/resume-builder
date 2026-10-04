// Text-only Markdown subset: headings, paragraphs, lists. Raw HTML and executable links never render.
export function SafeMarkdown({ text }: { text: string }) {
  return (
    <div className="rich-description">
      {text.split(/\n\s*\n/).map((block, i) => {
        const heading = /^(#{1,3})\s+([^\n]+)$/.exec(block);
        if (heading) return <h3 key={i}>{heading[2]}</h3>;
        if (block.split("\n").every((line) => /^[-*] /.test(line)))
          return (
            <ul key={i}>
              {block.split("\n").map((line, j) => (
                <li key={j}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        return (
          <p key={i} style={{ whiteSpace: "pre-line" }}>
            {block}
          </p>
        );
      })}
    </div>
  );
}
