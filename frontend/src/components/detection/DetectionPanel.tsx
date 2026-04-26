// components/detection/DetectionPanel.tsx
import { useState, useRef } from 'react';
import {
  runFullScan,
  runYolo,
  runFusion,
  convertToThermal,
  type ModelResult,
  type YoloResult,
  type AllModelsResult,
  type SecurityAssessment,
} from '../../api/detection';
import { useDetectionStore, type ScanMode } from '../../stores/detectionStore';
import { SecurityAlert, isTamperEvent } from './SecurityAlert';

// ─── Mode config ─────────────────────────────────────────────────────────────

const MODES: { key: ScanMode; label: string; description: string }[] = [
  { key: 'quick',  label: 'Quick Scan',      description: 'Models 1-3 in parallel' },
  { key: 'yolo',   label: 'YOLO Detection',  description: 'Model 4 — bounding boxes' },
  { key: 'fusion', label: 'Fusion Scan',      description: 'Model 5 — RGB + NIR' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function DetectionPanel() {
  const {
    activeMode, setActiveMode,
    quickResults, setQuickResults,
    yoloResult, setYoloResult,
    fusionResult, setFusionResult,
    clearResults,
  } = useDetectionStore();

  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imageUrl, setImageUrl]       = useState<string | null>(null);
  const [nirFile, setNirFile]         = useState<File | null>(null);
  const [nirUrl, setNirUrl]           = useState<string | null>(null);
  const [thermalLoading, setThermalLoading] = useState(false);
  const [thermalPreview, setThermalPreview] = useState<string | null>(null);
  const [sector, setSector]           = useState('Sector A');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [security, setSecurity]       = useState<SecurityAssessment | null>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const nirInputRef                   = useRef<HTMLInputElement>(null);

  // ── File handlers ──────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    clearResults();
    setError(null);
    setThermalPreview(null);
  };

  const handleNirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNirFile(file);
    setNirUrl(URL.createObjectURL(file));
    setError(null);
  };

  // ── Generate thermal from RGB ──────────────────────────────────────────────

  const handleGenerateThermal = async () => {
    if (!imageFile) return;
    setThermalLoading(true);
    setError(null);
    try {
      const data = await convertToThermal(imageFile);
      // Convert base64 grayscale to a File for the fusion endpoint
      const byteStr = atob(data.grayscale_image);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const nirBlob = new Blob([bytes], { type: 'image/jpeg' });
      const generatedFile = new File([nirBlob], 'pseudo-thermal.jpg', { type: 'image/jpeg' });
      setNirFile(generatedFile);
      setNirUrl(`data:image/jpeg;base64,${data.colormap_image}`);
      setThermalPreview(`data:image/jpeg;base64,${data.colormap_image}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Thermal conversion failed.');
    } finally {
      setThermalLoading(false);
    }
  };

  // ── Run scan ───────────────────────────────────────────────────────────────

  const handleRunScan = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);
    setSecurity(null);
    clearResults();

    try {
      if (activeMode === 'quick') {
        const data = await runFullScan(imageFile);
        setSecurity(data.security ?? null);
        setQuickResults(data);
      } else if (activeMode === 'yolo') {
        const data = await runYolo(imageFile);
        setSecurity(data.security ?? null);
        setYoloResult(data);
      } else if (activeMode === 'fusion') {
        if (!nirFile) {
          setError('Fusion scan requires both RGB and NIR images.');
          setLoading(false);
          return;
        }
        const data = await runFusion(imageFile, nirFile);
        setSecurity(data.security ?? null);
        setFusionResult(data);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Scan failed. Check backend connection.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const canRun =
    imageFile !== null && !loading && (activeMode !== 'fusion' || nirFile !== null);

  const scanLabel =
    activeMode === 'quick'  ? 'Run Quick Scan' :
    activeMode === 'yolo'   ? 'Run YOLO Scan'  :
                              'Run Fusion Scan';

  const hasResults = quickResults !== null || yoloResult !== null || fusionResult !== null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold">Fire Detection — Multi-Model Analysis</h2>

      {/* ── Mode tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-lg bg-[var(--color-bg-surface)] p-1 border border-[var(--color-border-default)]">
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => { setActiveMode(m.key); clearResults(); setError(null); setSecurity(null); }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeMode === m.key
                ? 'bg-[var(--color-accent)] text-black'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-alt)]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--color-text-muted)] -mt-2">
        {MODES.find(m => m.key === activeMode)?.description}
      </p>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-[var(--color-text-muted)]">Sector name</label>
          <input
            className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded px-3 py-2 text-sm w-48"
            value={sector}
            onChange={e => setSector(e.target.value)}
            placeholder="e.g. Sector A"
          />
        </div>

        <button
          className="bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-border-default)] border border-[var(--color-border-default)] rounded px-4 py-2 text-sm transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {activeMode === 'fusion' ? 'Upload RGB Image' : 'Upload Drone Frame'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {activeMode === 'fusion' && (
          <>
            <button
              className="bg-[var(--color-bg-surface-alt)] hover:bg-[var(--color-border-default)] border border-[var(--color-border-default)] rounded px-4 py-2 text-sm transition-colors"
              onClick={() => nirInputRef.current?.click()}
            >
              Upload NIR Image
            </button>
            <input
              ref={nirInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleNirChange}
            />
            <span className="text-xs text-[var(--color-text-muted)] self-center">or</span>
            <button
              className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                !imageFile || thermalLoading
                  ? 'bg-[var(--color-bg-surface-alt)] text-[var(--color-text-muted)] cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              }`}
              onClick={handleGenerateThermal}
              disabled={!imageFile || thermalLoading}
            >
              {thermalLoading ? (
                <span className="flex items-center gap-2"><Spinner /> Generating...</span>
              ) : 'Generate Thermal from RGB'}
            </button>
          </>
        )}

        <button
          className={`rounded px-6 py-2 text-sm font-medium transition-colors ${
            !canRun
              ? 'bg-[var(--color-bg-surface-alt)] text-[var(--color-text-muted)] cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
          onClick={handleRunScan}
          disabled={!canRun}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Scanning...
            </span>
          ) : scanLabel}
        </button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 rounded p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* ── Image preview(s) ─────────────────────────────────────────────── */}
      <div className="flex gap-4 flex-wrap">
        {imageUrl && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">
              {activeMode === 'fusion' ? 'RGB Input' : 'Drone Frame'}
            </span>
            <div className="relative inline-block max-w-sm border border-[var(--color-border-default)] rounded overflow-hidden">
              <img src={imageUrl} alt="RGB input" className="w-full" />
            </div>
          </div>
        )}
        {activeMode === 'fusion' && nirUrl && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">
              {thermalPreview ? 'Generated Thermal (NIR Input)' : 'NIR Input'}
            </span>
            <div className="relative inline-block max-w-sm border border-[var(--color-border-default)] rounded overflow-hidden">
              <img src={nirUrl} alt="NIR input" className="w-full" />
            </div>
          </div>
        )}
      </div>

      {/* ── Security alert ──────────────────────────────────────────────── */}
      <SecurityAlert security={security} />

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {hasResults && (
        <div className={`flex flex-col gap-3 mt-2 ${isTamperEvent(security) ? 'opacity-40 pointer-events-none' : ''}`}>
          {activeMode === 'quick'  && quickResults  && <QuickScanResults data={quickResults} />}
          {activeMode === 'yolo'   && yoloResult    && <YoloResults data={yoloResult} />}
          {activeMode === 'fusion' && fusionResult   && <FusionResults data={fusionResult} />}
        </div>
      )}
    </div>
  );
}

// ─── Quick Scan: single verdict + per-model breakdown ────────────────────────

function flipLabel(label: 'Fire' | 'No Fire'): 'Fire' | 'No Fire' {
  return label === 'Fire' ? 'No Fire' : 'Fire';
}

function QuickScanResults({ data }: { data: AllModelsResult }) {
  const models = [
    data.model1 ? { ...data.model1, label: flipLabel(data.model1.label) } : null,
    data.model2,
    data.model3,
  ];
  const fireDetected = models.some(m => m?.label === 'Fire');

  return (
    <div className="flex flex-col gap-4">
      {/* Overall verdict */}
      <div className={`rounded-lg border p-4 flex items-center gap-3 ${
        fireDetected
          ? 'bg-red-500/10 border-red-500/40'
          : 'bg-green-500/10 border-green-500/40'
      }`}>
        <span className={`text-2xl font-bold uppercase ${fireDetected ? 'text-red-400' : 'text-green-400'}`}>
          {fireDetected ? 'Fire Detected' : 'No Fire'}
        </span>
        {fireDetected && (
          <span className="text-sm text-[var(--color-text-muted)]">
            — at least one model flagged fire
          </span>
        )}
      </div>

      {/* Per-model breakdown */}
      <div className="flex flex-wrap gap-2">
        {models.map((result, i) =>
          result ? (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                result.label === 'Fire'
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-green-500/30 bg-green-500/10'
              }`}
            >
              <span className="text-xs text-[var(--color-text-muted)] font-medium">{result.model}</span>
              <span className={`font-semibold ${result.label === 'Fire' ? 'text-red-400' : 'text-green-400'}`}>
                {result.label}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">{result.prediction_time_ms.toFixed(0)}ms</span>
            </div>
          ) : (
            <div key={i} className="rounded-md border border-[var(--color-border-default)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
              Model {i + 1} not loaded
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── YOLO Results ────────────────────────────────────────────────────────────

function YoloResults({ data }: { data: YoloResult }) {
  const isFire = data.label === 'Fire Detected';

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
          isFire
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : 'bg-green-500/20 text-green-400 border border-green-500/30'
        }`}>
          {data.label}
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">
          {data.count} detection{data.count !== 1 ? 's' : ''} &middot; {data.prediction_time_ms.toFixed(0)}ms
        </span>
      </div>

      {/* Annotated image */}
      {data.annotated_image && (
        <div className="relative inline-block max-w-xl border border-[var(--color-border-default)] rounded overflow-hidden">
          <img
            src={`data:image/jpeg;base64,${data.annotated_image}`}
            alt="YOLO annotated"
            className="w-full"
          />
        </div>
      )}

      {data.detections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.detections.map((_, i) => (
            <div
              key={i}
              className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs text-[var(--color-text-muted)]"
            >
              Detection #{i + 1}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fusion Results ──────────────────────────────────────────────────────────

function FusionResults({ data }: { data: ModelResult }) {
  const isFire = data.label === 'Fire';
  return (
    <div className={`rounded-lg border p-4 flex items-center gap-3 ${
      isFire ? 'bg-red-500/10 border-red-500/40' : 'bg-green-500/10 border-green-500/40'
    }`}>
      <span className={`text-2xl font-bold uppercase ${isFire ? 'text-red-400' : 'text-green-400'}`}>
        {data.label}
      </span>
      <span className="text-xs text-[var(--color-text-muted)]">{data.model} · {data.prediction_time_ms.toFixed(0)}ms</span>
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
