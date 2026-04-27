import { useEffect } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLightbox } from "@/components/help/help-lightbox";

interface HelpImageProps {
  src?: string;
  alt: string;
  caption?: string;
  className?: string;
}

export function HelpImage({ src, alt, caption, className }: HelpImageProps) {
  const lightbox = useLightbox();

  useEffect(() => {
    if (src) lightbox?.register({ src, alt, caption });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <figure className={cn("my-4", className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn(
            "w-full rounded-lg border shadow-sm transition-opacity",
            lightbox && "cursor-zoom-in hover:opacity-90",
          )}
          onClick={lightbox ? () => lightbox.open(src) : undefined}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 py-12 text-muted-foreground">
          <ImageIcon className="h-8 w-8 opacity-40" />
          <span className="text-xs">{alt}</span>
        </div>
      )}
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
