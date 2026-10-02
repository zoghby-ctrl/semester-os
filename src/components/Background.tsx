import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useSystemReducedMotion } from "../lib/motion";
import { useApp } from "../lib/context";
import { ThemeScene } from "./themes/ThemeScene";
import { themePaused } from "../themes/definitions";
export function Background() {
  const { settings: s, wallpaper, toast } = useApp();
  const reduced = useSystemReducedMotion();
  const [url, setUrl] = useState("");
  const [visible, setVisible] = useState(!document.hidden);
  const video = useRef<HTMLVideoElement>(null);
  const wallpaperKey = wallpaper
    ? `${wallpaper.updatedAt ?? ""}:${wallpaper.name}:${wallpaper.type}:${wallpaper.blob.size}`
    : "";
  const pause = themePaused(s, reduced, visible);
  useEffect(() => {
    const visibility = () => {
      setVisible(!document.hidden);
      document.documentElement.dataset.pageHidden = String(document.hidden);
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      delete document.documentElement.dataset.pageHidden;
    };
  }, []);
  useEffect(() => {
    if (!wallpaper) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(wallpaper.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [wallpaperKey]);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (pause || document.hidden) el.pause();
    else
      el.play().catch(() =>
        toast("Wallpaper playback is unavailable. Try a different video file."),
      );
    const visibility = () => {
      if (document.hidden || pause) el.pause();
      else el.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [pause, url, toast, s.wallpaperEnabled]);
  const style = {
    "--motion": s.motion / 100,
    "--grain": s.grain / 100,
    "--wall-blur": `${s.blur}px`,
    "--wall-dim": s.dim / 100,
    "--speed": `${75 - s.motion * 0.5}s`,
    "--space-blur": `${s.prism.blur}px`,
    "--space-dim": s.prism.dim / 100,
  } as CSSProperties;
  return (
    <div
      className={`background ${pause || !visible ? "paused" : ""}`}
      style={style}
      aria-hidden="true"
    >
      {url &&
        s.wallpaperEnabled &&
        (wallpaper?.type.startsWith("video/") ? (
          <video
            ref={video}
            src={url}
            muted
            loop
            playsInline
            className="wallpaper"
            onError={() =>
              toast("This video format could not be played by your browser.")
            }
          />
        ) : (
          <WallpaperImage
            url={url}
            paused={!!pause}
            onError={() =>
              toast("This image could not be displayed. Choose another file.")
            }
          />
        ))}
      {url && s.wallpaperEnabled && <div className="wallpaper-dim" />}
      <ThemeScene settings={s} paused={pause} visible={visible} />
    </div>
  );
}

function WallpaperImage({
  url,
  paused,
  onError,
}: {
  url: string;
  paused: boolean;
  onError: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const error = useRef(onError);
  error.current = onError;
  useEffect(() => {
    if (!paused) return;
    const picture = new Image();
    let cancelled = false;
    picture.onload = () => {
      if (cancelled || !canvas.current) return;
      const scale = Math.min(
        1,
        4096 / Math.max(picture.naturalWidth, picture.naturalHeight),
      );
      canvas.current.width = Math.max(
        1,
        Math.round(picture.naturalWidth * scale),
      );
      canvas.current.height = Math.max(
        1,
        Math.round(picture.naturalHeight * scale),
      );
      canvas.current
        .getContext("2d")
        ?.drawImage(picture, 0, 0, canvas.current.width, canvas.current.height);
    };
    picture.onerror = () => !cancelled && error.current();
    picture.src = url;
    return () => {
      cancelled = true;
      picture.onload = null;
      picture.onerror = null;
    };
  }, [url, paused]);
  return paused ? (
    <canvas ref={canvas} className="wallpaper" />
  ) : (
    <img className="wallpaper" src={url} alt="" onError={onError} />
  );
}
