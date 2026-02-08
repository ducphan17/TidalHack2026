"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/shared";
import { Button } from "@/components/shared";

interface SlideUploadProps {
  onSlidesUploaded: (data: { slideCount: number; pdfBase64: string }) => void;
  disabled?: boolean;
}

export function SlideUpload({ onSlidesUploaded, disabled }: SlideUploadProps) {
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

        const res = await fetch("/api/slides/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to upload slides");
        }

        const { slideCount, pdfBase64 } = await res.json();
        setFileName(file.name);
        onSlidesUploaded({ slideCount, pdfBase64 });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [onSlidesUploaded]
  );

  const handleRemove = useCallback(() => {
    setFileName(null);
    onSlidesUploaded({ slideCount: 0, pdfBase64: "" });
  }, [onSlidesUploaded]);

  return (
    <Card
      variant="outlined"
      className="border-dashed !bg-[#A1C0D7]/80 !border-[#A1C0D7]/60"
    >
      <label className="block cursor-pointer">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
          className="sr-only"
        />
        <div className="flex flex-col items-center gap-2 py-4">
          {fileName ? (
            <>
              <span className="text-sm font-medium text-white">
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
              <span className="text-sm text-white">
                {isUploading
                  ? "Uploading slides..."
                  : "Upload your slides (PDF)"}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled || isUploading}
                className="!bg-[#A1C0D7] !text-white hover:!bg-[#8fb0c9] border border-[#A1C0D7]/60"
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
