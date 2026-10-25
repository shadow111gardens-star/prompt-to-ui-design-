import Navbar from "@/components/navbar";
import React from "react";
import { tokenHarborConfigurationError } from '@/lib/ai/tokenharbor';

type Props = {
  children: React.ReactNode;
};

const Layout = async ({ children }: Props) => {
  return (
    <div className="grid min-w-0 grid-cols-1">
      <Navbar modelConfigurationError={tokenHarborConfigurationError()} />
      {children}
    </div>
  );
};

export default Layout;
