import type { Metadata } from "next";
import { Host_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from '@/components/auth/provider';
import ReduxProvider from "@/redux/provider";
import { ThemeProvider } from "next-themes";

const hostGrotesk = Host_Grotesk({
  variable: "--font-host-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenUI - The Designer's Co-pilot",
  description: "Design Enterprise Grade UI with AI",
  authors: [{ name: "Alap Putatunda", url: "https://scalewithalap.com" }],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${hostGrotesk.variable} ${dmSans.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ReduxProvider>
            <AuthProvider>{children}<Toaster /></AuthProvider>
          </ReduxProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
