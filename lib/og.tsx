import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import {
  type DanceEvent,
  eventDateFull,
  eventTime,
  money,
} from "@/lib/event";

export const ogSize = {
  width: 1200,
  height: 630,
} as const;

export const ogContentType = "image/png";

const COLORS = {
  cream: "#fff9ef",
  creamDeep: "#f6e6cf",
  plum: "#321b39",
  coral: "#f45d35",
  coralSoft: "#ffd2c4",
  yellow: "#ffe08a",
  muted: "#6d5269",
} as const;

let logoPngDataUriPromise: Promise<string> | null = null;

async function getLogoDataUri() {
  if (!logoPngDataUriPromise) {
    logoPngDataUriPromise = (async () => {
      // Live site logo: public/logo.svg (served as /logo.svg)
      const svg = await readFile(join(process.cwd(), "public", "logo.svg"));
      const png = await sharp(svg).resize(320, 320).png().toBuffer();
      return `data:image/png;base64,${png.toString("base64")}`;
    })();
  }

  return logoPngDataUriPromise;
}

function shareEventWhen(event: DanceEvent) {
  return `${eventDateFull(event)} · ${eventTime(event)}–${eventTime(event, event.endsAt)}`;
}

export function shareSiteTitle(event: DanceEvent) {
  return `${event.name} | Big Mama Fitness`;
}

export function shareSiteDescription(event: DanceEvent) {
  return `Join Big Mama Fitness for a beginner-friendly Afro Dance Fitness class in ${event.city}. ${shareEventWhen(event)}. Tickets are ${money(event)}.`;
}

export function shareEventTitle(event: DanceEvent) {
  const short = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
  return `${event.name} — ${short}`;
}

export function shareEventDescription(event: DanceEvent) {
  return `${shareEventWhen(event)} in ${event.city}, ${event.province}. Tickets ${money(event)}. Beginner-friendly Afro Dance Fitness with Big Mama Fitness.`;
}

function AccentBars() {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        marginTop: 28,
      }}
    >
      <div
        style={{
          width: 72,
          height: 8,
          borderRadius: 999,
          background: COLORS.coral,
        }}
      />
      <div
        style={{
          width: 36,
          height: 8,
          borderRadius: 999,
          background: COLORS.yellow,
        }}
      />
      <div
        style={{
          width: 18,
          height: 8,
          borderRadius: 999,
          background: COLORS.coralSoft,
        }}
      />
    </div>
  );
}

function Shell({
  children,
  logoSrc,
}: {
  children: ReactNode;
  logoSrc: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(145deg, ${COLORS.cream} 0%, ${COLORS.creamDeep} 58%, #ffe8d4 100%)`,
        color: COLORS.plum,
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "rgba(244, 93, 53, 0.12)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -160,
          left: -100,
          width: 460,
          height: 460,
          borderRadius: "50%",
          background: "rgba(255, 224, 138, 0.28)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 14,
          background: `linear-gradient(90deg, ${COLORS.coral} 0%, ${COLORS.yellow} 55%, ${COLORS.coralSoft} 100%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            minWidth: 0,
            paddingRight: 40,
          }}
        >
          {children}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 280,
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            width={240}
            height={240}
            alt=""
            style={{
              width: 240,
              height: 240,
              borderRadius: 56,
              boxShadow: "0 24px 48px rgba(50, 27, 57, 0.18)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export async function siteOgImage() {
  const logoSrc = await getLogoDataUri();

  return new ImageResponse(
    <Shell logoSrc={logoSrc}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: COLORS.coral,
          }}
        >
          Big Mama Fitness
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 64,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            maxWidth: 720,
          }}
        >
          Afro Dance Fitness Nanaimo
        </div>
        <AccentBars />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 34, fontWeight: 700 }}>Saturday, Oct 17</div>
        <div style={{ fontSize: 30, fontWeight: 600, color: COLORS.muted }}>
          5:00–6:30 PM
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 28,
            fontWeight: 700,
            color: COLORS.plum,
          }}
        >
          $10 • Beginner-friendly
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 24,
            fontWeight: 600,
            color: COLORS.muted,
          }}
        >
          www.bigmamafit.ca
        </div>
      </div>
    </Shell>,
    {
      ...ogSize,
    },
  );
}

export async function eventOgImage(event: DanceEvent, sold = 0) {
  const logoSrc = await getLogoDataUri();
  const dateLabel = eventDateFull(event);
  const timeLabel = `${eventTime(event)}–${eventTime(event, event.endsAt)}`;
  const priceLabel = money(event);
  const spotsLeft = Math.max(event.capacity - sold, 0);

  return new ImageResponse(
    <Shell logoSrc={logoSrc}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: COLORS.coral,
          }}
        >
          Big Mama Fitness
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 58,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            maxWidth: 720,
          }}
        >
          {event.name}
        </div>
        <AccentBars />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{dateLabel}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: COLORS.muted }}>
          {timeLabel}
        </div>
        <div style={{ fontSize: 28, fontWeight: 600, color: COLORS.muted }}>
          {`${event.city}, ${event.province}`}
        </div>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: COLORS.plum,
            }}
          >
            {`Tickets ${priceLabel}`}
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: COLORS.coral,
            }}
          />
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.coral,
            }}
          >
            {`Only ${spotsLeft} spots`}
          </div>
        </div>
      </div>
    </Shell>,
    {
      ...ogSize,
    },
  );
}
