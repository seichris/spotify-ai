import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spotify Analyzer",
  description: "Analyze and sort your Spotify library by similarity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script id="canonical-localhost" strategy="beforeInteractive">
          {`if (window.location.hostname === "localhost") {
            const target = new URL(window.location.href);
            target.hostname = "127.0.0.1";
            if (target.pathname === "/login") target.pathname = "/";
            window.location.replace(target.toString());
          }`}
        </Script>
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
