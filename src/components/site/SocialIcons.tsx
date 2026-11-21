import { cn } from "@/lib/utils";

const paths = {
  facebook:
    "M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z",
  youtube:
    "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z",
  x: "M17.8 3h3l-6.6 7.6L22 21h-6.1l-4.8-6.3L5.6 21h-3l7.1-8.1L2.2 3h6.2l4.3 5.7L17.8 3Zm-1 16.2h1.7L7.3 4.7H5.5l11.3 14.5Z",
};

export function SocialIcons({
  links,
  className,
}: {
  links: { facebook: string; youtube: string; x: string };
  className?: string;
}) {
  const items = (Object.keys(paths) as Array<keyof typeof paths>).filter((k) => links[k]);
  if (!items.length) return null;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {items.map((k) => (
        <a
          key={k}
          href={links[k]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={k}
          className="grid size-7 place-items-center rounded-full bg-navy-foreground text-navy transition hover:bg-gold"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
            <path d={paths[k]} />
          </svg>
        </a>
      ))}
    </div>
  );
}
