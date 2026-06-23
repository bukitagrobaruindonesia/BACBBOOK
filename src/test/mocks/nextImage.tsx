import { vi } from "vitest";

vi.mock("next/image", () => ({
  default: vi.fn(({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    <img src={src} alt={alt} {...props} />
  )),
}));
