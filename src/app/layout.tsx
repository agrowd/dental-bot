import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OdontoBot",
  description: "Desarrollado por NexteMarketing y NatoH Software",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
