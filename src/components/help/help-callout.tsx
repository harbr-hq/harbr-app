import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpCalloutProps {
  type?: "tip" | "note" | "warning";
  children: React.ReactNode;
  className?: string;
}

const config = {
  tip: {
    icon: Lightbulb,
    label: "Tip",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    iconClass: "text-emerald-500",
  },
  note: {
    icon: Info,
    label: "Note",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    iconClass: "text-blue-500",
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    iconClass: "text-amber-500",
  },
};

export function HelpCallout({ type = "note", children, className }: HelpCalloutProps) {
  const { icon: Icon, label, className: typeClass, iconClass } = config[type];
  return (
    <div className={cn("my-4 flex gap-3 rounded-lg border px-4 py-3 text-sm", typeClass, className)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} />
      <div className="flex-1 leading-relaxed">
        <span className="font-semibold">{label}: </span>
        {children}
      </div>
    </div>
  );
}
