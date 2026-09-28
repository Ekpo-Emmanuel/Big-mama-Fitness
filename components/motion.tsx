"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

/** Short, presentation-only cues. Values come from the CSS motion tokens. */
export function useChangeMotion<T extends HTMLElement>(
  ref: RefObject<T | null>,
  value: string | number,
) {
  const previous = useRef(value);
  const running = useRef<Animation | null>(null);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cancel = () => running.current?.cancel();
    preference.addEventListener("change", cancel);
    document.addEventListener("keydown", cancel, true);
    return () => {
      cancel();
      preference.removeEventListener("change", cancel);
      document.removeEventListener("keydown", cancel, true);
    };
  }, []);
  useLayoutEffect(() => {
    const changed = previous.current !== value;
    previous.current = value;
    const element = ref.current;
    if (!changed || !element || !element.animate) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (
      preference.matches ||
      document.documentElement.dataset.motionInput === "keyboard"
    )
      return;
    const tokens = getComputedStyle(element);
    const opacity =
      running.current?.playState === "running"
        ? getComputedStyle(element).opacity
        : 0.65;
    running.current?.cancel();
    running.current = element.animate([{ opacity }, { opacity: 1 }], {
      duration: parseFloat(tokens.getPropertyValue("--motion-fast")),
      easing: tokens.getPropertyValue("--motion-enter").trim(),
    });
  }, [ref, value]);
}

export function MotionValue({
  value,
  children,
}: {
  value: string | number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useChangeMotion(ref, value);
  return (
    <span ref={ref} className="inline-block">
      {children}
    </span>
  );
}

/** Optional, once-only reveal. Server-rendered content is never hidden by JS. */
export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (
      !element ||
      preference.matches ||
      !window.IntersectionObserver ||
      !element.animate
    )
      return;
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (
          preference.matches ||
          document.documentElement.dataset.motionInput === "keyboard"
        )
          return;
        const tokens = getComputedStyle(element);
        animation = element.animate(
          [
            {
              opacity: 0.8,
              transform: `translateY(${tokens.getPropertyValue("--motion-distance").trim()})`,
            },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: parseFloat(tokens.getPropertyValue("--motion-slow")),
            easing: tokens.getPropertyValue("--motion-enter").trim(),
          },
        );
      },
      { threshold: 0.15 },
    );
    const cancel = () => {
      observer.disconnect();
      animation?.cancel();
    };
    preference.addEventListener("change", cancel);
    document.addEventListener("keydown", cancel, true);
    observer.observe(element);
    return () => {
      cancel();
      preference.removeEventListener("change", cancel);
      document.removeEventListener("keydown", cancel, true);
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Keyboard navigation gets immediate feedback, including native disclosures. */
export function MotionPreferences() {
  useEffect(() => {
    const keyboard = () => {
      document.documentElement.dataset.motionInput = "keyboard";
    };
    const pointer = () => {
      delete document.documentElement.dataset.motionInput;
    };
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", pointer, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", pointer, true);
      delete document.documentElement.dataset.motionInput;
    };
  }, []);
  return null;
}
