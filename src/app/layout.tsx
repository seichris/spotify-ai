import type { Metadata } from "next";
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
      <body className="font-sans">
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(() => {
              if (window.location.hostname === "localhost") {
                const target = new URL(window.location.href);
                target.hostname = "127.0.0.1";
                window.location.replace(target.toString());
              }
            })();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
