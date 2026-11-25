import React from "react";
import { cn } from "../../lib/utils";

export interface HqWeeklyStripProps {
  className?: string;
  style?: React.CSSProperties;
  days?: string[];
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
}

const DEFAULT_WEEK_DAYS = [
  "Sun Oct 01",
  "Mon Oct 02",
  "Tue Oct 03",
  "Wed Oct 04",
  "Thu Oct 05",
  "Fri Oct 06",
  "Sat Oct 07",
];

export function HqWeeklyStrip({
  className,
  style,
  days = DEFAULT_WEEK_DAYS,
  onPrevWeek,
  onNextWeek,
}: HqWeeklyStripProps) {
  return (
    <div
      style={style}
      className={cn(
        "ecmd-hq-weekly-strip-root bg-[#222] border border-gray-800 rounded flex items-center justify-between p-2",
        className
      )}
    >
      <button
        id="btnPrevWeek"
        onClick={onPrevWeek}
        className="px-3 py-1 bg-gray-800 text-white rounded text-sm hover:bg-gray-700"
      >
        &lt;
      </button>
      <div id="repWeekly" className="flex space-x-2 flex-1 justify-center">
        {days.map((day, i) => (
          <div
            key={i}
            className="flex flex-col items-center bg-[#111] border border-gray-700 p-2 rounded min-w-[90px]"
          >
            <span className="text-xs font-bold mb-2 text-gray-300">{day}</span>
            <div className="text-[10px] text-gray-500 flex flex-col gap-1 w-full">
              <div className="bg-gray-800 text-center rounded py-0.5">x 0</div>
              <div className="bg-gray-800 text-center rounded py-0.5">x 0</div>
              <div className="bg-gray-800 text-center rounded py-0.5">x 0</div>
            </div>
          </div>
        ))}
      </div>
      <button
        id="btnNextWeek"
        onClick={onNextWeek}
        className="px-3 py-1 bg-gray-800 text-white rounded text-sm hover:bg-gray-700"
      >
        &gt;
      </button>
    </div>
  );
}

export default HqWeeklyStrip;
