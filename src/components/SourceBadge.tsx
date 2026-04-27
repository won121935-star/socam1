import { cn } from "@/lib/cn";

export function SourceBadge({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const labels: Record<string, { text: string; color: string }> = {
    youtube: { text: "YouTube", color: "bg-red-600/90 text-white" },
    tvcf: { text: "TVCF", color: "bg-emerald-600/90 text-white" },
    other: { text: "기타", color: "bg-zinc-600/90 text-white" },
  };
  const info = labels[source] ?? labels.other;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        info.color,
        className,
      )}
    >
      {info.text}
    </span>
  );
}
