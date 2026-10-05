"use client";
import { useRef, useState } from "react";
export function AssetUpload({
  kind,
  onUploaded,
}: {
  kind: "PORTRAIT" | "REFERENCE";
  onUploaded: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="studio-upload">
      <label>
        {kind === "PORTRAIT"
          ? "Upload a portrait"
          : "Upload a template reference"}
        <input
          ref={input}
          type="file"
          disabled={busy}
          accept={
            kind === "PORTRAIT"
              ? "image/png,image/jpeg,image/webp,image/gif"
              : "image/png,image/jpeg,image/webp,image/gif,application/pdf"
          }
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 4 * 1024 * 1024) {
              setError("Choose a file smaller than 4 MB.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              const query = new URLSearchParams({
                kind,
                name: file.name.slice(0, 120),
              });
              const response = await fetch(`/api/admin/assets?${query}`, {
                method: "POST",
                headers: {
                  "Content-Type": file.type || "application/octet-stream",
                },
                body: file,
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error);
              onUploaded(result.id);
              if (input.current) input.current.value = "";
            } catch (e) {
              setError(e instanceof Error ? e.message : "Upload failed.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <small>
        {busy
          ? "Uploading..."
          : kind === "PORTRAIT"
            ? "PNG, JPEG, WebP or GIF, up to 4 MB. Uploaded photos start private."
            : "A resume screenshot or PDF, up to 4 MB. References stay private."}
      </small>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
