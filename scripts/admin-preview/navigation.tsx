import React from "react";
export default function Link({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
export function usePathname() {
  return window.location.pathname;
}
export function useRouter() {
  return router;
}
const router = {
  refresh: () => window.dispatchEvent(new Event("preview-refresh")),
  replace: (href: string) => {
    window.location.href = href;
  },
};
export function notFound(): never {
  throw new Error("Page not found");
}
export function redirect(href: string): never {
  window.location.href = href;
  throw new Error("Redirect");
}
