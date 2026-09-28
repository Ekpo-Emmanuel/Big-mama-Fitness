"use client";
import { useEffect, useRef } from "react";
export function EventMedia({ src, poster }: { src: string; poster: string }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (preference.matches) video.current?.pause();
      else void video.current?.play().catch(() => {});
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  return (
    <video
      ref={video}
      muted
      loop
      playsInline
      controls
      preload="metadata"
      poster={poster}
      className="aspect-[4/5] w-full rounded-2xl object-cover"
      aria-label="A preview of the dance class"
    >
      <source src={src} />
    </video>
  );
}
