import React, { useState } from "react";
import { cn } from "../../lib/utils";

export interface HqMultiStateWorkspaceProps {
  className?: string;
  style?: React.CSSProperties;
  activeTab?: string;
  tabs?: string[];
  onTabChange?: (tab: string) => void;
  aiResponseTitle?: string;
  aiResponseText?: string;
  aiCodeBoxTitle?: string;
  aiCodeSnippet?: string;
  onSubmitJob?: () => void;
  inputPlaceholder?: string;
}

const DEFAULT_TABS = [
  "#msbCustomer",
  "#msbOffice",
  "#pRepeater",
  "#previousRep",
  "#bookingRep",
  "Detail Calendar",
];

export function HqMultiStateWorkspace({
  className,
  style,
  activeTab: controlledTab,
  tabs = DEFAULT_TABS,
  onTabChange,
  aiResponseTitle = "A.I. Response Title/Text",
  aiResponseText = "I am analyzing the customer details and package configuration. Ready to assist with dispatch scheduling and routing.",
  aiCodeBoxTitle = "A.I. Code Box Title/Text",
  aiCodeSnippet = `{\n  "action": "dispatch",\n  "priority": "high",\n  "confidence": 0.98\n}`,
  onSubmitJob,
  inputPlaceholder = "Type / to use skills [Flash]",
}: HqMultiStateWorkspaceProps) {
  const [internalTab, setInternalTab] = useState(DEFAULT_TABS[0]);
  const currentTab = controlledTab ?? internalTab;

  const handleTabClick = (tab: string) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div
      style={style}
      className={cn(
        "ecmd-hq-workspace-root bg-[#111] border border-gray-800 rounded mt-4 flex flex-col h-64 overflow-hidden",
        className
      )}
    >
      <div id="tabMenu" className="flex border-b border-gray-800 bg-[#1a1a1a]">
        {tabs.map((tab) => {
          const isActive = tab === currentTab;
          return (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={cn(
                "px-4 py-2 text-xs font-bold transition-colors",
                isActive
                  ? "text-emerald-400 border-b-2 border-emerald-400"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div id="tabRepeater" className="flex-1 p-4 flex gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col border border-gray-800 rounded bg-[#1a1a1a] p-3">
          <div className="text-xs font-bold text-gray-500 mb-2">
            {aiResponseTitle}
          </div>
          <div className="flex-1 text-sm text-gray-300 overflow-y-auto leading-relaxed whitespace-pre-wrap">
            {aiResponseText}
          </div>
          <button
            type="button"
            onClick={onSubmitJob}
            className="mt-2 text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors w-fit"
          >
            Dispatch Demo
          </button>
        </div>
        <div className="flex-1 flex flex-col border border-gray-800 rounded bg-[#1a1a1a] p-3">
          <div className="text-xs font-bold text-gray-500 mb-2">
            {aiCodeBoxTitle}
          </div>
          <div className="flex-1 bg-black rounded p-2 font-mono text-xs text-emerald-400 overflow-y-auto">
            <pre className="whitespace-pre-wrap">{aiCodeSnippet}</pre>
          </div>
        </div>
      </div>

      <div className="bg-black border-t border-gray-800 p-2 flex items-center">
        <div className="w-3 h-3 rounded-full bg-emerald-500 mr-3 shadow-[0_0_8px_#10b981] animate-pulse"></div>
        <input
          type="text"
          placeholder={inputPlaceholder}
          className="bg-transparent border-none outline-none text-sm text-white flex-1 font-mono placeholder-gray-600"
        />
      </div>
    </div>
  );
}

export default HqMultiStateWorkspace;
