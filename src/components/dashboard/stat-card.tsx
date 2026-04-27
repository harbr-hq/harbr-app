import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  title,
  icon: Icon,
  value,
  subtext,
  href,
  loading = false,
}: {
  title: string;
  icon: React.ElementType;
  value: number | string;
  subtext: string;
  href: string;
  loading?: boolean;
}) {
  return (
    <Link to={href}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
              {loading ? (
                <Skeleton className="h-9 w-14 mt-1 mb-1" />
              ) : (
                <p className="text-3xl font-bold tracking-tight leading-none mt-1">{value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">{subtext}</p>
            </div>
            <Icon className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
