import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SafeMarkdown } from "../src/components/safe-markdown";

it("presents reply lists as bullets while retaining item order, details and uncertainty", () => {
  const text =
    "Skills:\n1. **SQL** reporting\n2. Deployment experience is uncertain.\n\n- `React` project\n- No relevant evidence is currently stored.";
  const html = renderToStaticMarkup(<SafeMarkdown text={text} bulletLists />);
  expect(html).toContain(
    "<ul><li><strong>SQL</strong> reporting</li><li>Deployment experience is uncertain.</li></ul>",
  );
  expect(html).toContain(
    "<ul><li><code>React</code> project</li><li>No relevant evidence is currently stored.</li></ul>",
  );
  expect(html).not.toContain("<ol>");
  expect(renderToStaticMarkup(<SafeMarkdown text={text} />)).toContain("<ol>");
});
