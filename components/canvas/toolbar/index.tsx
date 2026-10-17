import React from "react";
import HistoryPill from "@/components/canvas/toolbar/history";
import ZoomBar from "@/components/canvas/toolbar/zoom";
import ToolBarShapes from "@/components/canvas/toolbar/shapes";

const Toolbar = () => {
  return (
    <div style={{ width: "calc(100% - var(--openui-inspector-width, 0px) - var(--openui-chat-width, 0px))" }} className="fixed bottom-0 left-0 w-full flex flex-wrap xl:flex-nowrap gap-2 justify-between items-center z-50 p-3 xl:p-5 pointer-events-none">
      <div className="pointer-events-auto order-2 xl:order-1 shrink-0">
        <HistoryPill />
      </div>
      <div className="pointer-events-auto order-1 xl:order-2 w-full xl:w-auto min-w-0">
        <ToolBarShapes />
      </div>
      <div className="pointer-events-auto order-3 shrink-0">
        <ZoomBar />
      </div>
    </div>
  );
};

export default Toolbar;
