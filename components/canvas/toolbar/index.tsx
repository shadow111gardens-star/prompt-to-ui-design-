import React from "react";
import HistoryPill from "@/components/canvas/toolbar/history";
import ZoomBar from "@/components/canvas/toolbar/zoom";
import ToolBarShapes from "@/components/canvas/toolbar/shapes";

const Toolbar = () => {
  return (
    <div style={{ width: "calc(100% - var(--openui-inspector-width, 0px) - var(--openui-chat-width, 0px))" }} className="fixed bottom-0 left-0 w-full flex flex-wrap 2xl:flex-nowrap gap-2 justify-between items-center z-50 p-2 sm:p-3 2xl:p-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto order-2 2xl:order-1 shrink-0">
        <HistoryPill />
      </div>
      <div className="pointer-events-auto order-1 2xl:order-2 w-full 2xl:w-auto min-w-0">
        <ToolBarShapes />
      </div>
      <div className="pointer-events-auto order-3 shrink-0">
        <ZoomBar />
      </div>
    </div>
  );
};

export default Toolbar;
