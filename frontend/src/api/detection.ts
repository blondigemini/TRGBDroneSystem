// api/detection.ts
// API calls for the 5-model fire detection backend
import client from './client';

// ─── Response types ──────────────────────────────────────────────────────────

/** Tamper event detail returned when frame verification fails. */
export interface TamperEvent {
  code: string;
  detail: string;
}

/** Cryptographic frame verification result appended to every inference response. */
export interface SecurityAssessment {
  status: 'OK' | 'UNSIGNED' | 'HASH_MISMATCH' | 'SIGNATURE_INVALID' | 'CHAIN_BROKEN';
  frame_hash: string;
  tamper_event: TamperEvent | null;
}

/** Binary classification result from Models 1, 2, 3, or 5. */
export interface ModelResult {
  model: string;
  label: 'Fire' | 'No Fire';
  probability: number;
  threshold: number;
  confidence: 'High' | 'Medium' | 'Low';
  prediction_time_ms: number;
  security?: SecurityAssessment | null;
}

/** Single YOLO bounding-box detection. */
export interface YoloDetection {
  box: [number, number, number, number]; // [x1, y1, x2, y2] in pixels
  confidence: number;
}

/** YOLO object-detection result from Model 4. */
export interface YoloResult {
  model: string;
  label: 'Fire Detected' | 'No Fire Detected';
  detections: YoloDetection[];
  annotated_image: string; // base64 JPEG
  count: number;
  prediction_time_ms: number;
  security?: SecurityAssessment | null;
}

/** Parallel result from /predict/all (Models 1-3). */
export interface AllModelsResult {
  model1: ModelResult | null;
  model2: ModelResult | null;
  model3: ModelResult | null;
  security?: SecurityAssessment | null;
}

// ─── API functions ───────────────────────────────────────────────────────────

function makeFormData(file: File, fieldName = 'file'): FormData {
  const fd = new FormData();
  fd.append(fieldName, file);
  return fd;
}

const FORM_HEADERS = { 'Content-Type': 'multipart/form-data' };

/** Run Models 1-3 in parallel on a single image. */
export async function runFullScan(file: File): Promise<AllModelsResult> {
  const { data } = await client.post<AllModelsResult>(
    '/predict/all',
    makeFormData(file),
    { headers: FORM_HEADERS },
  );
  return data;
}

/** Run a single model (1-4) on an image. */
export async function runModel(
  modelNumber: 1 | 2 | 3 | 4,
  file: File,
): Promise<ModelResult | YoloResult> {
  const { data } = await client.post(
    `/predict/model${modelNumber}`,
    makeFormData(file),
    { headers: FORM_HEADERS },
  );
  return data;
}

/** Run YOLO (Model 4) on an image. */
export async function runYolo(file: File): Promise<YoloResult> {
  const { data } = await client.post<YoloResult>(
    '/predict/model4',
    makeFormData(file),
    { headers: FORM_HEADERS },
  );
  return data;
}

// ─── Thermal conversion types & function ────────────────────────────────────

/** Result of converting an RGB image to pseudo-thermal. */
export interface ThermalConversionResult {
  grayscale_image: string;  // base64 JPEG — model-compatible
  colormap_image: string;   // base64 JPEG — visual INFERNO preview
  processing_time_ms: number;
}

/** Convert an RGB image to pseudo-thermal (grayscale + colormap preview). */
export async function convertToThermal(file: File): Promise<ThermalConversionResult> {
  const { data } = await client.post<ThermalConversionResult>(
    '/tools/rgb-to-thermal',
    makeFormData(file),
    { headers: FORM_HEADERS },
  );
  return data;
}

/** Run Fusion (Model 5) with RGB + NIR images. */
export async function runFusion(
  rgbFile: File,
  nirFile: File,
): Promise<ModelResult> {
  const fd = new FormData();
  fd.append('rgb_file', rgbFile);
  fd.append('nir_file', nirFile);
  const { data } = await client.post<ModelResult>(
    '/predict/model5',
    fd,
    { headers: FORM_HEADERS },
  );
  return data;
}
