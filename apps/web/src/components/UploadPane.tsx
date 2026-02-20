'use client';

import React, { useCallback } from 'react';
import { Upload } from 'lucide-react';
import { useEkgStore } from '../store/ekgStore';
import { ingestFile, ApiError } from '../lib/apiClient';

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp';

export function UploadPane() {
  const {
    uploadStatus,
    uploadError,
    setSessionId,
    setUploadStatus,
    setDigitizationResult,
    setOriginalImagePreviewUrl,
  } = useEkgStore();
  const [progress, setProgress] = React.useState(0);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      const valid = /\.(pdf|png|jpg|jpeg|gif|webp)$/i.test(file.name);
      if (!valid) {
        setUploadStatus('error', 'Unsupported file type. Please use PDF or image files.');
        return;
      }
      setUploadStatus('uploading');
      setProgress(0);
      const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name);
      const previewUrl = isImage ? URL.createObjectURL(file) : null;
      if (previewUrl) setOriginalImagePreviewUrl(previewUrl);
      try {
        const { session_id } = await ingestFile(file, (pct) => setProgress(pct));
        setSessionId(session_id);
        setUploadStatus('digitizing');
        setDigitizationResult(null);
      } catch (e) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setOriginalImagePreviewUrl(null);
        const msg = e instanceof ApiError ? e.message : 'Upload failed. Please try again.';
        setUploadStatus('error', msg);
      }
    },
    [setSessionId, setUploadStatus, setDigitizationResult, setOriginalImagePreviewUrl]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = '';
    },
    [handleUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onClick = useCallback(() => inputRef.current?.click(), []);

  if (uploadStatus === 'uploading') {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center min-h-[200px] bg-slate-50 dark:bg-slate-900/50">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 dark:text-slate-300 mb-2">Uploading…</p>
        <div className="w-48 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 transition-all duration-300"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <p className="text-sm text-slate-500 mt-2">{Math.round(progress)}%</p>
      </div>
    );
  }

  if (uploadStatus !== 'idle' && uploadStatus !== 'error') {
    return null;
  }

  return (
    <div
      className={`
        border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center
        transition-colors min-h-[200px]
        ${dragOver ? 'border-teal-500 bg-teal-500/5' : 'border-slate-400/60 hover:border-slate-500'}
        ${uploadError ? 'border-red-400 bg-red-500/5' : ''}
      `}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <Upload className="w-12 h-12 text-slate-400 mb-4" />
      <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">
        Drag and drop ECG file here, or click to browse
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        PDF and images (PNG, JPG, GIF, WebP)
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={onFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={onClick}
        className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
      >
        Choose file
      </button>
      {uploadError && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  );
}
