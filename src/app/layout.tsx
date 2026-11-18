import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wallmarkt — Find your next favorite thing",
  description: "A friendly local marketplace for things worth passing on.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
