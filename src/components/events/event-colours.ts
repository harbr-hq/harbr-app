// Shared event colour maps and labels — used by both events.index.tsx and the dashboard.

export const ACTION_LABELS: Record<string, string> = {
  start:        "started",
  create:       "created",
  stop:         "stopped",
  die:          "exited",
  kill:         "killed",
  oom:          "out of memory",
  destroy:      "removed",
  remove:       "removed",
  delete:       "deleted",
  restart:      "restarted",
  exec_create:  "exec",
  exec_start:   "exec",
  pull:         "pulled",
  push:         "pushed",
  import:       "imported",
  tag:          "tagged",
  connect:      "connected",
  disconnect:   "disconnected",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}



export const ACTION_COLOURS: Record<string, string> = {
  start:       "bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400 dark:border-green-500/30",
  create:      "bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400 dark:border-green-500/30",
  exec_create: "bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400 dark:border-green-500/30",
  exec_start:  "bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400 dark:border-green-500/30",
  stop:        "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400 dark:border-red-500/30",
  die:         "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400 dark:border-red-500/30",
  kill:        "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400 dark:border-red-500/30",
  oom:         "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400 dark:border-red-500/30",
  destroy:     "bg-orange-500/10 text-orange-600 border-orange-500/30 dark:text-orange-400 dark:border-orange-500/30",
  remove:      "bg-orange-500/10 text-orange-600 border-orange-500/30 dark:text-orange-400 dark:border-orange-500/30",
  delete:      "bg-orange-500/10 text-orange-600 border-orange-500/30 dark:text-orange-400 dark:border-orange-500/30",
  restart:     "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400 dark:border-blue-500/30",
  pull:        "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400 dark:border-purple-500/30",
  push:        "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400 dark:border-purple-500/30",
  import:      "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400 dark:border-purple-500/30",
  tag:         "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400 dark:border-purple-500/30",
};

export const TYPE_COLOURS: Record<string, string> = {
  container: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400 dark:border-sky-500/30",
  image:     "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-400 dark:border-violet-500/30",
  volume:    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400 dark:border-amber-500/30",
  network:   "bg-teal-500/10 text-teal-700 border-teal-500/30 dark:text-teal-400 dark:border-teal-500/30",
};

export function actionColour(action: string): string {
  return ACTION_COLOURS[action] ?? "bg-secondary text-secondary-foreground border-border";
}

export function typeColour(typ: string): string {
  return TYPE_COLOURS[typ] ?? "bg-secondary text-secondary-foreground border-border";
}
