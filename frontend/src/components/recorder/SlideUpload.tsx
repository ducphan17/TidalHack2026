"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/shared";
import { Button } from "@/components/shared";

interface SlideUploadProps {
  onSlidesParsed: (slideContent: string) => void;
  disabled?: boolean;
}

export function SlideUpload({ onSlidesParsed, disabled }: SlideUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/parse-slides", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to parse slides");
        }

        const { slides } = await res.json();
        setFileName(file.name);
        onSlidesParsed(slides);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [onSlidesParsed]
  );

  const handleRemove = useCallback(() => {
    setFileName(null);
    onSlidesParsed("");
  }, [onSlidesParsed]);

  return (
    <Card variant="outlined" className="border-dashed">
      <label className="block cursor-pointer">
        <input
          type="file"
          accept=".pptx"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
          className="sr-only"
        />
        <div className="flex flex-col items-center gap-2 py-4">
          {fileName ? (
            <>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {fileName}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  handleRemove();
                }}
              >
                Remove
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {isUploading
                  ? "Parsing slides…"
                  : "Upload your slides (PPTX)"}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled || isUploading}
                onClick={(e) => {
                  e.preventDefault();
                  (e.target as HTMLElement).closest("label")?.querySelector("input")?.click();
                }}
              >
                Choose file
              </Button>
            </>
          )}
        </div>
      </label>
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </Card>
  );
}
