"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api";

function resolveEndpoint(endpoint: string) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
}

interface AudioPlayerProps {
  endpoint: string;
  buttonText: string;
  className?: string;
  size?: "sm" | "default";
}

export function AudioPlayer({
  endpoint,
  buttonText,
  className = "",
  size = "default",
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const togglePlay = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    if (!audioRef.current) {
      setIsLoading(true);
      setFailed(false);
      try {
        const res = await fetch(resolveEndpoint(endpoint), {
          method: "POST",
        });
        if (!res.ok) {
          throw new Error(`Audio fetch failed (${res.status})`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        audioRef.current = new Audio(url);
        audioRef.current.onended = () => {
          if (audioRef.current) audioRef.current.currentTime = 0;
          setIsPlaying(false);
        };
      } catch (err) {
        console.warn("Failed to load audio", err);
        setFailed(true);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }

    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn("Failed to play audio", err);
      }
    }
  };

  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={togglePlay}
      disabled={isLoading}
      aria-busy={isLoading}
      title={failed ? "Audio unavailable — check the backend voice configuration" : undefined}
      aria-label={failed ? `${buttonText}: audio unavailable` : undefined}
      className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border font-medium transition-colors disabled:cursor-wait ${
        failed
          ? "border-slate-700 text-slate-400"
          : isSmall
            ? "border-slate-700 bg-white/5 text-slate-200 hover:border-lex-accent/60 hover:bg-white/10"
            : "border-indigo-400/30 bg-lex-accent/10 text-indigo-200 hover:bg-lex-accent/20"
      } ${isSmall ? "px-3 text-xs" : "px-4 text-sm"} ${className}`}
    >
      {isLoading ? (
        <Loader2 aria-hidden="true" className={`animate-spin ${isSmall ? "w-3 h-3" : "w-4 h-4"}`} />
      ) : isPlaying ? (
        <Square aria-hidden="true" className={`fill-current ${isSmall ? "w-3 h-3" : "w-4 h-4"}`} />
      ) : (
        <Play aria-hidden="true" className={`fill-current ${isSmall ? "w-3 h-3" : "w-4 h-4"}`} />
      )}
      {isLoading ? "Generating…" : isPlaying ? "Stop" : failed ? "Audio unavailable" : buttonText}
    </button>
  );
}
