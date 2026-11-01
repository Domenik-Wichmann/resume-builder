# Sonaway portfolio interactive study

The Sonaway project guide adds a selective explanation of taxonomy, ontology,
frames, evidence-addressable assertions and recursive process composition. It
connects these choices to the owner's system-design work and keeps architecture
direction separate from claims about production implementation.

Sources reviewed on 2026-11-01:

- ghost-shadow/docs/systemwright/architecture/SONAWAY_SEMANTIC_ARCHITECTURE_V1.md
- sonaway.com/index.html and its intake, knowledge and property model assets

The standalone HTML documents in public/demos/sonaway extract only the guided
intake and knowledge-lab elements from the hospitality site. Controllers, models
and styles are copied locally; portfolio-embed.css provides framing overrides.
There is no dependency on the marketing site's availability, cloud account,
production operational data, provider request or publication endpoint.

The guided conversation and animated record discovery are scripted. The
property model supports inheritance, retained exceptions and matching-parent
normalization. The other tabs resolve seasonal/event policy sources and
illustrate audience-specific presentation; they are not production permissions.

Iframes use allow-scripts without allow-same-origin. Each document blocks
connections and forms with CSP. Only these HTML routes override X-Frame-Options
to SAMEORIGIN and allow same-origin ancestors; other app routes retain DENY.
The inline definitions, contextual help, keyboard controls, reset and reduced
motion behaviors remain part of the imported demonstrations.

Vitest checks scoped propagation, event fallback, every offered intake route,
local dependencies and framing protections. Browser verification exercises
controls inside the actual iframe rather than only inspecting its HTML.
