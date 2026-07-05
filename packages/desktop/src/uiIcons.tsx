import type { SVGProps } from "react";

export type AppIconName =
  | "cad"
  | "customTools"
  | "download"
  | "excel"
  | "home"
  | "monitor"
  | "moreTools"
  | "revit"
  | "settings"
  | "shareTools"
  | "tekla"
  | "workflow";

interface AppIconProps {
  name: AppIconName;
  className?: string;
  title?: string;
}

const baseSvgProps: SVGProps<SVGSVGElement> = {
  className: "uiIconSvg",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg"
};

export function AppIcon({ name, className = "", title }: AppIconProps) {
  return (
    <span
      className={["uiIcon", `uiIcon-${name}`, className].filter(Boolean).join(" ")}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {renderIcon(name, title)}
    </span>
  );
}

function renderIcon(name: AppIconName, title?: string) {
  switch (name) {
    case "home":
      return (
        <svg {...baseSvgProps} viewBox="0 0 24 24" fill="currentColor">
          {title ? <title>{title}</title> : null}
          <path d="M3 10.8 12 3l4.1 3.6V4.4h3.2v5l1.7 1.5-1.8 2.1-1.2-1v8.7h-4.6v-5.8h-2.8v5.8H6V12l-1.2 1L3 10.8Z" />
        </svg>
      );
    case "cad":
      return <LetterIcon letter="A" title={title} />;
    case "revit":
      return <LetterIcon letter="R" title={title} />;
    case "excel":
      return <LetterIcon letter="X" title={title} />;
    case "tekla":
      return <LetterIcon letter="T" title={title} />;
    case "workflow":
      return (
        <svg
          {...baseSvgProps}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {title ? <title>{title}</title> : null}
          <rect x="3.5" y="4.5" width="6" height="6" rx="1.6" />
          <rect x="14.5" y="4.5" width="6" height="6" rx="1.6" />
          <rect x="9" y="14" width="6" height="6" rx="1.6" />
          <path d="M9.5 7.5h5" />
          <path d="m7.7 10 3.5 4.2" />
          <path d="m16.3 10-3.5 4.2" />
        </svg>
      );
    case "moreTools":
      return (
        <svg {...baseSvgProps} fill="currentColor">
          {title ? <title>{title}</title> : null}
          <path d="M21.7 6.3a6.8 6.8 0 0 1-8.6 8.6l-7 7a2.6 2.6 0 0 1-3.7-3.7l7-7A6.8 6.8 0 0 1 18 2.6l-3.4 3.4 1.2 3.1 3.1 1.2 3.4-3.4c-.1-.2-.3-.4-.6-.6Z" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M12.2 3h-.4a1.7 1.7 0 0 0-1.7 1.7v.2a1.7 1.7 0 0 1-.9 1.5l-.4.2a1.7 1.7 0 0 1-1.7 0L7 6.5a1.7 1.7 0 0 0-2.3.6l-.2.4a1.7 1.7 0 0 0 .6 2.3l.2.1a1.7 1.7 0 0 1 .8 1.5v.5a1.7 1.7 0 0 1-.8 1.5l-.2.1a1.7 1.7 0 0 0-.6 2.3l.2.4a1.7 1.7 0 0 0 2.3.6l.2-.1a1.7 1.7 0 0 1 1.7 0l.4.2a1.7 1.7 0 0 1 .9 1.5v.2a1.7 1.7 0 0 0 1.7 1.7h.4a1.7 1.7 0 0 0 1.7-1.7v-.2a1.7 1.7 0 0 1 .9-1.5l.4-.2a1.7 1.7 0 0 1 1.7 0l.2.1a1.7 1.7 0 0 0 2.3-.6l.2-.4a1.7 1.7 0 0 0-.6-2.3l-.2-.1a1.7 1.7 0 0 1-.8-1.5v-.5a1.7 1.7 0 0 1 .8-1.5l.2-.1a1.7 1.7 0 0 0 .6-2.3l-.2-.4a1.7 1.7 0 0 0-2.3-.6l-.2.1a1.7 1.7 0 0 1-1.7 0l-.4-.2a1.7 1.7 0 0 1-.9-1.5v-.2A1.7 1.7 0 0 0 12.2 3Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "shareTools":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <circle cx="7" cy="7" r="2.4" />
          <circle cx="17" cy="7" r="2.4" />
          <circle cx="12" cy="17" r="2.4" />
          <path d="m9 8.4 2 5.3M15 8.4l-2 5.3" />
        </svg>
      );
    case "customTools":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="m5 17.7 3.2-.7L18.6 6.6a2 2 0 0 0-2.8-2.8L5.4 14.2 5 17.7Z" />
          <path d="m14.4 5.2 4.4 4.4" />
          <path d="M4 21h16" />
        </svg>
      );
    case "download":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M12 4v10" />
          <path d="m7.5 10 4.5 4.5L16.5 10" />
          <path d="M5 19h14" />
        </svg>
      );
    default:
      return null;
  }
}

function LetterIcon({ letter, title }: { letter: string; title?: string }) {
  return (
    <svg {...baseSvgProps} viewBox="0 0 24 24">
      {title ? <title>{title}</title> : null}
      <text x="12" y="12.8" textAnchor="middle" className="uiIconText">
        {letter}
      </text>
    </svg>
  );
}
