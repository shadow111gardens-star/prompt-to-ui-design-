import Navbar from "@/components/navbar";
import React from "react";
import { geminiConfigurationError } from '@/lib/ai/gemini';

type Props = {
  children: React.ReactNode;
};

const Layout = async ({ children }: Props) => {
  return (
    <div className="grid min-w-0 grid-cols-1">
      <Navbar modelConfigurationError={geminiConfigurationError()} />
      {children}
    </div>
  );
};

export default Layout;
