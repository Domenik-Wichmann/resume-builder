"use client";
import {
  projectLinkTypes,
  projectLinkUrl,
  newProjectLink,
  type ProjectLink,
} from "@/lib/portfolio/edit-links";
import { safeProjectUrl } from "@/lib/portfolio/model";
export function ProjectLinksEditor({
  links,
  change,
}: {
  links: ProjectLink[];
  change: (links: ProjectLink[]) => void;
}) {
  function update(index: number, patch: Partial<ProjectLink>) {
    change(
      links.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    );
  }
  function move(index: number, offset: number) {
    const next = [...links];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    change(next.map((link, i) => ({ ...link, display_order: i })));
  }
  return (
    <section className="project-link-workspace" aria-label="Project links">
      <h3>Links visitors can open</h3>
      <p className="muted">
        Add the website, GitHub repository or demo. These become buttons at the
        top of the project page when you save and publish.
      </p>
      <div className="project-link-add">
        {(["LIVE", "GITHUB", "DEMO"] as const).map((type) => (
          <button
            key={type}
            type="button"
            disabled={links.length >= 12}
            onClick={() =>
              change([...links, newProjectLink(type, links.length)])
            }
          >
            + Add {projectLinkTypes.find((item) => item.value === type)?.label}
          </button>
        ))}
        <button
          type="button"
          disabled={links.length >= 12}
          onClick={() =>
            change([...links, newProjectLink("OTHER", links.length)])
          }
        >
          + Other link
        </button>
      </div>
      {!links.length && (
        <div className="resume-empty">
          No links yet. Choose one of the buttons above to get started.
        </div>
      )}
      {links.map((link, index) => (
        <fieldset className="project-link-card" key={index}>
          <legend>
            Link {index + 1} · {link.label || "New link"}
          </legend>
          <div className="project-link-fields">
            <label>
              Link type
              <select
                value={link.link_type}
                onChange={(event) =>
                  update(index, {
                    link_type: event.target.value as ProjectLink["link_type"],
                  })
                }
              >
                {projectLinkTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Button label
              <input
                value={link.label}
                maxLength={100}
                required
                onChange={(event) =>
                  update(index, { label: event.target.value })
                }
              />
            </label>
            <label className="project-link-url">
              Web address
              <input
                type="text"
                inputMode="url"
                autoCapitalize="none"
                spellCheck={false}
                value={link.url}
                maxLength={2000}
                placeholder="https://your-project.com"
                required
                onChange={(event) => update(index, { url: event.target.value })}
                onBlur={() => update(index, { url: projectLinkUrl(link.url) })}
              />
            </label>
          </div>
          <div className="project-link-actions">
            <label className="check-label">
              <input
                type="checkbox"
                checked={link.is_public}
                onChange={(event) =>
                  update(index, { is_public: event.target.checked })
                }
              />
              Include on the project page
            </label>
            {safeProjectUrl(link.url) && (
              <a
                className="text-link"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Test link ↗
              </a>
            )}
            <button
              type="button"
              className="secondary-button"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label={`Move link ${index + 1} up`}
            >
              ↑
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={index === links.length - 1}
              onClick={() => move(index, 1)}
              aria-label={`Move link ${index + 1} down`}
            >
              ↓
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                change(
                  links
                    .filter((_, i) => i !== index)
                    .map((value, i) => ({ ...value, display_order: i })),
                )
              }
            >
              Remove link {index + 1}
            </button>
          </div>
        </fieldset>
      ))}
    </section>
  );
}
