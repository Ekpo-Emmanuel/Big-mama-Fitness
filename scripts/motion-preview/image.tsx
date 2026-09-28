import React from "react";
import type { ImageProps } from "next/image";
export default function Image({
  src,
  alt,
  width,
  height,
  className,
}: ImageProps) {
  // QA shim only; production continues using next/image.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : ""}
      alt={alt}
      width={Number(width)}
      height={Number(height)}
      className={className}
    />
  );
}
