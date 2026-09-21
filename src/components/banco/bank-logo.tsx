"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { bankBrandColor, bankIconCandidates, bankInitials } from "@/lib/banco/bank-assets";

const SIZES = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-11 w-11 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

export function BankLogo({
  institutionId,
  name,
  size = "md",
  className,
}: {
  institutionId: string;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const candidates = bankIconCandidates(institutionId, name);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [institutionId, name]);

  const src = candidates[index];
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-xl font-semibold text-white",
          SIZES[size],
          className,
        )}
        style={{ backgroundColor: bankBrandColor(institutionId, name) }}
      >
        {bankInitials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={88}
      height={88}
      className={cn(
        "shrink-0 rounded-xl bg-white object-contain ring-1 ring-neutral-light/60",
        SIZES[size],
        className,
      )}
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
