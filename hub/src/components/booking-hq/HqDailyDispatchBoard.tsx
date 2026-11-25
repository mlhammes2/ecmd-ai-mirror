import React from "react";
import { cn } from "../../lib/utils";

export interface HqDailyDispatchBoardProps {
  className?: string;
  style?: React.CSSProperties;
  dateText?: string;
  teams?: number[];
  timeSlots?: string[];
  onSlotClick?: (team: number, slot: string) => void;
}

const DEFAULT_TEAMS = [1, 2, 3];
const DEFAULT_SLOTS = ["9-11am", "1-3pm", "4-6pm"];

export function HqDailyDispatchBoard({
  className,
  style,
  dateText = "Wednesday - Feb 25th, 2026",
  teams = DEFAULT_TEAMS,
  timeSlots = DEFAULT_SLOTS,
  onSlotClick,
}: HqDailyDispatchBoardProps) {
  return (
    <div
      style={style}
      className={cn(
        "ecmd-hq-daily-dispatch-root bg-[#222] border border-gray-800 rounded p-4 flex flex-col gap-4",
        className
      )}
    >
      <h2 id="textDaily" className="text-lg font-semibold text-emerald-400">
        {dateText}
      </h2>
      <div id="repDaily" className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {teams.map((team) => (
          <div
            key={team}
            className="bg-[#111] border border-gray-700 rounded p-3 flex gap-4"
          >
            <div className="w-32 flex flex-col items-center justify-center border-r border-gray-800 pr-4">
              <span className="font-bold text-gray-300">Team {team}</span>
              <span className="text-xs text-gray-600">Active</span>
            </div>
            <div className="flex-1 flex gap-2">
              {timeSlots.map((slot) => (
                <div
                  key={slot}
                  onClick={() => onSlotClick?.(team, slot)}
                  className="flex-1 bg-[#1a1a1a] border border-gray-800 rounded p-2 flex flex-col gap-1 text-center justify-center cursor-pointer hover:border-emerald-500/50"
                >
                  <span className="text-xs text-emerald-500 font-mono">
                    {slot}
                  </span>
                  <span className="text-[10px] text-gray-500">---</span>
                  <span className="text-[10px] text-gray-500">---</span>
                  <span className="text-[10px] text-gray-500">---</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HqDailyDispatchBoard;
