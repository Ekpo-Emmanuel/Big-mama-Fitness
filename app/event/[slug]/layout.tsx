import { AnalyticsProvider } from "@/components/analytics-provider";
export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <AnalyticsProvider />
    </>
  );
}
