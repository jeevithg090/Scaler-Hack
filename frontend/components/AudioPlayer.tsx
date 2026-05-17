"use client";

import { useState, useRef } from "react";
import { Play, Square, Loader2 } from "lucide-react";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    if (!audioRef.current) {
      setIsLoading(true);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Audio fetch failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioRef.current = new Audio(url);
        audioRef.current.onended = () => setIsPlaying(false);
      } catch (err) {
        console.error("Failed to load audio", err);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }

    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const isSmall = size === "sm";

  return (
    <button
      onClick={togglePlay}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 rounded-full font-medium transition-all ${
        isSmall
          ? "px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/70"
          : "px-4 py-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
      } ${className}`}
    >
      {isLoading ? (
        <Loader2 className={`animate-spin ${isSmall ? "w-3 h-3" : "w-4 h-4"}`} />
      ) : isPlaying ? (
        <Square className={`fill-current ${isSmall ? "w-3 h-3" : "w-4 h-4"}`} />
      ) : (
        <Play className={`fill-current ${isSmall ? "w-3 h-3" : "w-4 h-4"}`} />
      )}
      {isPlaying ? "Stop" : buttonText}
    </button>
  );
}
