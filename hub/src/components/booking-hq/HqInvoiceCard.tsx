import React from "react";
import { cn } from "../../lib/utils";

export interface LineItem {
  label: string;
  price: string;
  isDiscount?: boolean;
}

export interface HqInvoiceCardProps {
  className?: string;
  style?: React.CSSProperties;
  packageName?: string;
  tag?: string;
  vehicleDescription?: string;
  location?: string;
  customerName?: string;
  addressLine1?: string;
  addressLine2?: string;
  lineItems?: LineItem[];
  arrivalDetails?: string;
  totalPrice?: string;
}

const DEFAULT_LINE_ITEMS: LineItem[] = [
  { label: "Pet Hair Removal", price: "+$45.00" },
  { label: "Special Offer", price: "-$20.00", isDiscount: true },
];

export function HqInvoiceCard({
  className,
  style,
  packageName = "Full Premium Detail",
  tag = "Online Web",
  vehicleDescription = "2024 Ford F-150 Black 22ft",
  location = "Destin FL 32541",
  customerName = "John Doe",
  addressLine1 = "Street Address One",
  addressLine2 = "Street Address Two",
  lineItems = DEFAULT_LINE_ITEMS,
  arrivalDetails = "Wed, Oct 28, 2026 @ 9-11am Arrival",
  totalPrice = "$304.00",
}: HqInvoiceCardProps) {
  return (
    <div
      style={style}
      className={cn(
        "ecmd-hq-invoice-card-root bg-[#222] border border-gray-800 rounded p-4 flex flex-col",
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-md font-bold text-white leading-tight">
          {packageName}
        </h3>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
          {tag}
        </span>
      </div>
      <div className="text-xs text-gray-400 mb-4 font-mono space-y-1">
        <div>{vehicleDescription}</div>
        <div>{location}</div>
        <div className="text-gray-200 mt-2 font-bold">{customerName}</div>
        <div>{addressLine1}</div>
        <div>{addressLine2}</div>
      </div>
      <div className="border-t border-gray-800 py-3 space-y-2 text-xs">
        {lineItems.map((item, idx) => (
          <div key={idx} className="flex justify-between text-gray-400">
            <span>{item.label}</span>
            <span
              className={
                item.isDiscount ? "text-emerald-400" : "text-gray-300"
              }
            >
              {item.price}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-800 pt-3 mt-auto flex justify-between items-end">
        <div className="text-xs text-gray-500">{arrivalDetails}</div>
        <div className="text-lg text-emerald-400 font-bold">{totalPrice}</div>
      </div>
    </div>
  );
}

export default HqInvoiceCard;
