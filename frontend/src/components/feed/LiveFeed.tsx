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

function isYouTubeEmbed(url: string) {
  return url.includes("youtube.com/embed");
}

export function LiveFeed({ detection, onTogglePause, onSwitchCamera }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const feedPaused = useDashboardStore((s) => s.feedPaused);
  const cameraMode = useDashboardStore((s) => s.cameraMode);

  useEffect(() => {
    if (!detection || !canvasRef.current) return;

    const canvas = canvasRef.current;

    const drawBoxes = () => {
      const w = containerRef.current?.clientWidth || 640;
      const h = containerRef.current?.clientHeight || 360;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);

      for (const box of detection.hotspots) {
        const x = box.x * w;
        const y = box.y * h;
        const bw = box.width * w;
        const bh = box.height * h;

        const color = SEVERITY_COLORS[detection.severity] ?? "#f97316";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, bw, bh);
      }
    };

    if (isYouTubeEmbed(detection.image_url)) {
      drawBoxes();
    } else {
      const img = imgRef.current;
      if (!img) return;
      if (img.complete) drawBoxes();
      else img.onload = drawBoxes;
    }
  }, [detection]);

  const isVideo = detection ? isYouTubeEmbed(detection.image_url) : false;

  return (
    <Card className="relative flex flex-col" title="Live Feed">
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-md bg-black"
      >
        {detection ? (
          <>
            {isVideo ? (
              <iframe
                src={detection.image_url}
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media"
                allowFullScreen={false}
              />
            ) : (
              <img
                ref={imgRef}
                src={detection.image_url}
                alt="Drone feed"
                className="h-full w-full object-cover"
                crossOrigin="anonymous"
              />
            )}
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

        {detection && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2">
            <Badge severity={detection.severity}>{detection.severity}</Badge>
            <span className="rounded bg-black/70 px-2 py-0.5 text-xs text-white">
              {detection.classification === "fire" ? "Fire detected" : "No fire detected"}
            </span>
          </div>
        )}

        {feedPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-lg font-bold text-white">PAUSED</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onTogglePause}
          className="flex items-center gap-1 rounded-md bg-[var(--color-bg-surface-alt)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-default)] transition-colors"
        >
          {feedPaused ? <Play size={14} /> : <Pause size={14} />}
          {feedPaused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() => onSwitchCamera(cameraMode === "thermal" ? "rgb" : "thermal")}
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
