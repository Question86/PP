import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PromptPage - Ergo NFT Prompt Marketplace",
  description: "Store and mint your prompts as Ergo NFTs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="bg-gray-800 text-white p-4">
          <div className="container mx-auto">
            <h1 className="text-2xl font-bold">PromptPage</h1>
          </div>
        </nav>
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="bg-gray-100 mt-16 py-8">
          <div className="container mx-auto px-4 text-center text-gray-600">
            <p>© 2026 PromptPage - Non-custodial Ergo dApp</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
