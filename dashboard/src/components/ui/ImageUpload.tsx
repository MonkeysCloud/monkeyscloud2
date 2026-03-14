"use client";

import { useState, useRef, useCallback, type ChangeEvent, type DragEvent } from "react";
import { Camera, Loader2, X, ImagePlus, Upload } from "lucide-react";
import { api } from "@/lib/api";
import clsx from "clsx";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  entityType: string;
  entityId: string | number;
  label?: string;
  sublabel?: string;
  size?: number;
  shape?: "circle" | "rounded";
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

export function ImageUpload({
  value,
  onChange,
  entityType,
  entityId,
  label = "Logo",
  sublabel = "Optional • JPG, PNG, WebP, SVG",
  size = 80,
  shape = "rounded",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPG, PNG, WebP, GIF, or SVG allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("entity_type", entityType);
      formData.append("entity_id", String(entityId));
      formData.append("files", file);

      const res = await api.upload<{ data: { file_url: string }[] }>(
        "/api/v1/attachments/upload",
        formData
      );

      const fileUrl = res?.data?.[0]?.file_url;
      if (fileUrl) {
        onChange(fileUrl);
      } else {
        setError("Upload failed — no URL returned");
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [entityType, entityId, onChange]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleClear() {
    onChange("");
    setError("");
  }

  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-xl";

  return (
    <div>
      {label && (
        <label className="block text-[13px] font-medium text-surface-300 mb-2">
          {label}{" "}
          <span className="text-surface-600 text-[13px] font-normal">{sublabel}</span>
        </label>
      )}

      <div className="flex items-center gap-4">
        {/* Drop zone / Preview */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={uploading}
          style={{ width: value ? size : Math.max(size, 120), height: value ? size : Math.max(size, 80) }}
          className={clsx(
            "relative flex flex-col items-center justify-center border-2 border-dashed transition-all overflow-hidden",
            shapeClass,
            dragging
              ? "border-primary-400 bg-primary-500/10 ring-2 ring-primary-400/30 scale-[1.02]"
              : value
                ? "border-primary-500/40 bg-surface-900"
                : "border-surface-700 bg-surface-800/40 hover:border-surface-500 hover:bg-surface-800/70",
            uploading && "cursor-wait opacity-60"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 text-primary-400 animate-spin" />
              <span className="text-xs text-surface-400 mt-1">Uploading…</span>
            </>
          ) : value ? (
            <>
              <img
                src={value}
                alt="Preview"
                className={clsx("w-full h-full object-cover", shapeClass)}
              />
              {/* Hover overlay */}
              <div className={clsx(
                "absolute inset-0 bg-black/50 flex flex-col items-center justify-center",
                "opacity-0 hover:opacity-100 transition-opacity gap-1",
                shapeClass
              )}>
                <Camera className="h-4 w-4 text-white" />
                <span className="text-xs text-white/80 font-medium">Change</span>
              </div>
            </>
          ) : dragging ? (
            <>
              <Upload className="h-5 w-5 text-primary-400" />
              <span className="text-xs text-primary-400 mt-1 font-medium">Drop it!</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-5 w-5 text-surface-500" />
              <span className="text-xs text-surface-500 mt-1">Click or drag</span>
            </>
          )}
        </button>

        {/* Actions */}
        <div className="flex flex-col gap-1.5">
          {!value && !uploading && (
            <p className="text-[13px] text-surface-500 leading-relaxed">
              Drop an image here<br />or click to browse
            </p>
          )}
          {value && !uploading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[13px] text-surface-500 hover:text-red-400 transition-colors flex items-center gap-1 w-fit"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && <p className="mt-1.5 text-[13px] text-red-400">{error}</p>}
    </div>
  );
}
