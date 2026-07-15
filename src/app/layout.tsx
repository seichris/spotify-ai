import type { Metadata } from "next";
import "./globals.css";

const title = "Endless Songs — Explore Your Music Taste";
const description =
  "Turn your Spotify taste into an explorable music map, then discover new songs that match the tracks and vibes you already love.";
const socialImage = {
  url: "/endless-songs-music-map.png",
  width: 3762,
  height: 1276,
  alt: "Endless Songs music map",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://endlesssongs.com"),
  title,
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Endless Songs",
    title,
    description,
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
  },
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
