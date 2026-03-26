import { useRef, useEffect } from "react";
import type { DetectionResult } from "../../types/detection";
import { SEVERITY_COLORS } from "../../utils/constants";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { Camera, Pause, Play } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";

interface Props {
  detection: DetectionResult | null;
  onTogglePause: () => void;
  onSwitchCamera: (mode: "thermal" | "rgb") => void;
}

export function LiveFeed({ detection, onTogglePause, onSwitchCamera }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const feedPaused = useDashboardStore((s) => s.feedPaused);
  const cameraMode = useDashboardStore((s) => s.cameraMode);

  useEffect(() => {
    if (!detection || !canvasRef.current || !imgRef.current) return;

    const img = imgRef.current;
    const canvas = canvasRef.current;

    const draw = () => {
      canvas.width = img.naturalWidth || 400;
      canvas.height = img.naturalHeight || 300;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const box of detection.hotspots) {
        const x = box.x * canvas.width;
        const y = box.y * canvas.height;
        const w = box.width * canvas.width;
        const h = box.height * canvas.height;

        const color = SEVERITY_COLORS[detection.severity] ?? "#f97316";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = color;
        ctx.font = "bold 12px system-ui";
        const label = `${(detection.confidence * 100).toFixed(0)}%`;
        ctx.fillRect(x, y - 18, ctx.measureText(label).width + 8, 18);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, x + 4, y - 5);
      }
    };

    if (img.complete) {
      draw();
    } else {
      img.onload = draw;
    }
  }, [detection]);

  return (
    <Card className="relative flex flex-col" title="Live Feed">
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
        {detection ? (
          <>
            <img
              ref={imgRef}
              src={detection.image_url}
              alt="Drone feed"
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
            <Camera size={48} className="opacity-30" />
          </div>
        )}

        {/* Detection info overlay */}
        {detection && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2">
            <Badge severity={detection.severity}>{detection.severity}</Badge>
            <span className="rounded bg-black/70 px-2 py-0.5 text-xs text-white">
              {detection.classification === "fire"
                ? `Fire detected (${(detection.confidence * 100).toFixed(0)}%)`
                : "No fire detected"}
            </span>
          </div>
        )}

        {feedPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-lg font-bold text-white">PAUSED</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onTogglePause}
          className="flex items-center gap-1 rounded-md bg-[var(--color-bg-surface-alt)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-default)] transition-colors"
        >
          {feedPaused ? <Play size={14} /> : <Pause size={14} />}
          {feedPaused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() =>
            onSwitchCamera(cameraMode === "thermal" ? "rgb" : "thermal")
          }
          className="flex items-center gap-1 rounded-md bg-[var(--color-bg-surface-alt)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-default)] transition-colors"
        >
          <Camera size={14} />
          {cameraMode === "thermal" ? "Switch to RGB" : "Switch to Thermal"}
        </button>
        {detection && (
          <span className="ml-auto text-xs text-[var(--color-text-muted)]">
            Model: {detection.model_type.toUpperCase()}
          </span>
        )}
      </div>
    </Card>
  );
}
