import type { Metadata } from "next";
import Navbar from "../components/Navbar/Navbar";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

import { Providers } from "../app/Providers";

export const metadata: Metadata = {
  title: "CirclePay ⛽️",
  description: "Gasless USDC transfers powered by EIP-3009",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
