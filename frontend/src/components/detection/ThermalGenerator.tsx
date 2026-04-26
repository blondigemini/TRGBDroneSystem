// components/detection/ThermalGenerator.tsx
// Standalone tool: convert an RGB image to pseudo-thermal for visual preview
// and for use as NIR input in Fusion Scan (Model 5).

import { useState, useRef } from 'react';
import {
  convertToThermal,
  runFusion,
  type ThermalConversionResult,
  type ModelResult,
} from '../../api/detection';

type PreviewMode = 'colormap' | 'grayscale';

export function ThermalGenerator() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [sourceFile, setSourceFile]       = useState<File | null>(null);
  const [sourceUrl, setSourceUrl]         = useState<string | null>(null);
  const [result, setResult]               = useState<ThermalConversionResult | null>(null);
  const [previewMode, setPreviewMode]     = useState<PreviewMode>('colormap');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // Fusion quick-run state
  const [fusionLoading, setFusionLoading] = useState(false);
  const [fusionResult, setFusionResult]   = useState<ModelResult | null>(null);
  const [fusionError, setFusionError]     = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setFusionResult(null);
    setFusionError(null);
  };

  const handleConvert = async () => {
    if (!sourceFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFusionResult(null);
    setFusionError(null);

    try {
      const data = await convertToThermal(sourceFile);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conversion failed. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  /** Use the generated grayscale as NIR input and run Fusion (Model 5) directly. */
  const handleUseFusion = async () => {
    if (!sourceFile || !result) return;
    setFusionLoading(true);
    setFusionError(null);
    setFusionResult(null);

    try {
      // Convert the base64 grayscale back to a File object for the fusion endpoint
      const b64 = result.grayscale_image;
      const byteStr = atob(b64);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const nirBlob = new Blob([bytes], { type: 'image/jpeg' });
      const nirFile = new File([nirBlob], 'pseudo-thermal.jpg', { type: 'image/jpeg' });

      const data = await runFusion(sourceFile, nirFile);
      setFusionResult(data);
    } catch (err: unknown) {
      setFusionError(err instanceof Error ? err.message : 'Fusion scan failed.');
    } finally {
      setFusionLoading(false);
    }
  };

  const previewSrc = result
    ? `data:image/jpeg;base64,${previewMode === 'colormap' ? result.colormap_image : result.grayscale_image}`
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Thermal Image Generator</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Convert an RGB image into a simulated thermal view. Use the generated output as NIR input for the Fusion model when a real thermal camera isn't available.
        </p>
      </div>

      {/* Upload & convert controls */}
      <div className="flex flex-wrap items-end gap-3">
        <button
          className="bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-border-default)] border border-[var(--color-border-default)] rounded px-4 py-2 text-sm transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload RGB Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
            !sourceFile || loading
              ? 'bg-[var(--color-bg-surface-alt)] text-[var(--color-text-muted)] cursor-not-allowed'
              : 'bg-orange-600 hover:bg-orange-500 text-white'
          }`}
          onClick={handleConvert}
          disabled={!sourceFile || loading}
        >
          {loading ? (
            <span className="flex items-center gap-2"><Spinner /> Converting...</span>
          ) : 'Generate Thermal'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 rounded p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Images grid */}
      <div className="flex gap-4 flex-nowrap overflow-x-auto items-start">
        {/* Source image */}
        {sourceUrl && (
          <div className="flex flex-col gap-1 w-[500px] shrink-0">
            <span className="text-xs text-[var(--color-text-muted)]">Original RGB</span>
            <div className="border border-[var(--color-border-default)] rounded overflow-hidden mt-[3px]">
              <img src={sourceUrl} alt="Original RGB" className="w-full" />
            </div>
          </div>
        )}

        {/* Generated thermal */}
        {previewSrc && (
          <div className="flex flex-col gap-1 w-[500px] shrink-0">
            {/* Toggle between colormap / grayscale */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">Generated Thermal</span>
              <div className="flex rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] ml-auto">
                <button
                  onClick={() => setPreviewMode('colormap')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-l-md transition-colors ${
                    previewMode === 'colormap'
                      ? 'bg-orange-600 text-white'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Thermal View
                </button>
                <button
                  onClick={() => setPreviewMode('grayscale')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-r-md transition-colors ${
                    previewMode === 'grayscale'
                      ? 'bg-orange-600 text-white'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Grayscale (Model Input)
                </button>
              </div>
            </div>
            <div className="border border-[var(--color-border-default)] rounded overflow-hidden -mt-[6px]">
              <img src={previewSrc} alt="Pseudo-thermal" className="w-full" />
            </div>
            {result && (
              <span className="text-xs text-[var(--color-text-muted)]">
                Generated in {result.processing_time_ms.toFixed(0)}ms
              </span>
            )}
          </div>
        )}
      </div>

      {/* Use in Fusion action */}
      {result && (
        <div className="flex flex-col gap-3 p-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Run Fusion Scan</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Use the original RGB + generated pseudo-thermal as inputs for Model 5 (Fusion).
              </p>
            </div>
            <button
              className={`rounded px-5 py-2 text-sm font-medium transition-colors ${
                fusionLoading
                  ? 'bg-[var(--color-bg-surface-alt)] text-[var(--color-text-muted)] cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
              onClick={handleUseFusion}
              disabled={fusionLoading}
            >
              {fusionLoading ? (
                <span className="flex items-center gap-2"><Spinner /> Running Fusion...</span>
              ) : 'Run Fusion with Pseudo-Thermal'}
            </button>
          </div>

          {fusionError && (
            <div className="bg-red-900/50 border border-red-600 rounded p-3 text-sm text-red-200">
              {fusionError}
            </div>
          )}

          {fusionResult && <FusionResultCard result={fusionResult} />}
        </div>
      )}
    </div>
  );
}

// ─── Fusion result card ─────────────────────────────────────────────────────

function FusionResultCard({ result }: { result: ModelResult }) {
  const isFire = result.label === 'Fire';

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface-alt)] p-4 flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {result.model}
      </span>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-4 py-1.5 text-sm font-bold uppercase ${
          isFire
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : 'bg-green-500/20 text-green-400 border border-green-500/30'
        }`}>
          {result.label}
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">
          {result.prediction_time_ms.toFixed(0)}ms
        </span>
      </div>
    </div>
  );
}

// ─── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
