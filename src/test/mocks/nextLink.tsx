import { vi } from "vitest";

vi.mock("next/link", () => ({
  default: vi.fn(({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  )),
}));
