"use client";
import { useState, type FormEvent } from "react";
import Image from "next/image";
import { AssetUpload } from "./asset-upload";
import type { OwnerAsset } from "@/lib/resume-design/model";
import type { PresentationSettings } from "@/lib/markets";
export function PresentationManager({
  initial,
  initialAssets,
}: {
  initial: PresentationSettings[];
  initialAssets: OwnerAsset[];
}) {
  const [assets, setAssets] = useState(initialAssets);
  async function uploaded() {
    const response = await fetch("/api/admin/assets", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setAssets(result.assets);
  }
  return (
    <div className="admin-grid studio-contact-grid">
      {initial.map((settings) => (
        <PresentationForm
          key={settings.market}
          initial={settings}
          assets={assets}
          onUploaded={uploaded}
        />
      ))}
    </div>
  );
}
function PresentationForm({
  initial,
  assets,
  onUploaded,
}: {
  initial: PresentationSettings;
  assets: OwnerAsset[];
  onUploaded: () => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cannot save details.");
      setValue((previous) => ({ ...previous, version: result.version }));
      setMessage(
        value.is_public
          ? "Saved for public display when the canonical profile is published."
          : "Saved privately.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot save details.");
    } finally {
      setBusy(false);
    }
  }
  const fields = [
    { key: "location", label: "City / region", max: 200 },
    { key: "address", label: "Address to display", max: 500 },
    { key: "contact_email", label: "Contact email", max: 254 },
    { key: "phone", label: "Phone number", max: 80 },
    {
      key: "work_authorization",
      label: "Work authorization / availability",
      max: 500,
    },
    {
      key: "photo_url",
      label: "Portrait image URL (optional)",
      max: 2000,
    },
  ] as const;
  return (
    <form className="project-card presentation-form" onSubmit={save}>
      <h2>{value.market === "US" ? "United States" : "Bulgaria"}</h2>
      <fieldset disabled={busy}>
        <AssetUpload
          kind="PORTRAIT"
          onUploaded={(id) => {
            void onUploaded()
              .then(() =>
                setValue((previous) => ({
                  ...previous,
                  photo_url: `/assets/${id}`,
                })),
              )
              .catch((e) => setError(e.message));
          }}
        />
        <div className="portrait-library">
          {assets
            .filter((a) => a.kind === "PORTRAIT")
            .map((a) => (
              <div key={a.id}>
                <button
                  type="button"
                  aria-pressed={value.photo_url === `/assets/${a.id}`}
                  onClick={() =>
                    setValue({ ...value, photo_url: `/assets/${a.id}` })
                  }
                >
                  <Image
                    src={`/assets/${a.id}`}
                    width={76}
                    height={76}
                    unoptimized
                    alt={a.name}
                  />
                  <span>{a.name}</span>
                </button>
                <button
                  className="record-text-button"
                  type="button"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Delete this unused portrait from the photo library?",
                      )
                    )
                      return;
                    try {
                      const response = await fetch("/api/admin/assets", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: a.id }),
                      });
                      const result = await response.json();
                      if (!response.ok) throw new Error(result.error);
                      await onUploaded();
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Cannot delete portrait.",
                      );
                    }
                  }}
                >
                  Delete unused photo
                </button>
              </div>
            ))}
        </div>
        {value.photo_url && (
          <button
            className="record-text-button"
            type="button"
            onClick={() => setValue({ ...value, photo_url: "" })}
          >
            Remove portrait from this presentation
          </button>
        )}

        {fields.map(({ key, label, max }) => (
          <label key={key}>
            {label}
            <input
              type={key === "contact_email" ? "email" : "text"}
              value={value[key]}
              maxLength={max}
              onChange={(event) =>
                setValue({ ...value, [key]: event.target.value })
              }
            />
          </label>
        ))}
        <label className="publish-contact">
          <input
            type="checkbox"
            checked={value.is_public}
            onChange={(event) =>
              setValue({ ...value, is_public: event.target.checked })
            }
          />{" "}
          Publish these contact details
        </label>
        <p className="muted">
          Published addresses, phone numbers and photos appear on the public
          portfolio. Leave fields blank to omit them. A portrait URL should
          point to an image you control.
        </p>
        <button>{busy ? "Saving…" : "Save presentation"}</button>
      </fieldset>
      <p role="status">{message}</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
