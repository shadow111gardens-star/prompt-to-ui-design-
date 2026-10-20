import Navbar from "@/components/navbar";
import React from "react";

type Props = {
  children: React.ReactNode;
};

const Layout = async ({ children }: Props) => {
  return (
    <div className="grid min-w-0 grid-cols-1">
      <Navbar />
      {children}
    </div>
  );
};

export default Layout;
