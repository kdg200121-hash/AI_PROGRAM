import type { SVGProps } from "react";

export type AppIconName =
  | "activeFileUnknown"
  | "cad"
  | "customTools"
  | "download"
  | "edit"
  | "excel"
  | "folder"
  | "home"
  | "market"
  | "monitor"
  | "moreTools"
  | "objectData"
  | "numberData"
  | "preview"
  | "promptAttached"
  | "promptDetached"
  | "revit"
  | "save"
  | "search"
  | "settings"
  | "shareTools"
  | "tekla"
  | "textData"
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
    case "activeFileUnknown":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
          <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2.8c0 2.1-2.6 2.2-2.6 4" />
          <path d="M12 16.8h.01" />
        </svg>
      );
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
    case "objectData":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <rect x="5" y="5" width="6" height="6" rx="1.4" />
          <rect x="13" y="5" width="6" height="6" rx="1.4" />
          <rect x="5" y="13" width="6" height="6" rx="1.4" />
          <rect x="13" y="13" width="6" height="6" rx="1.4" />
        </svg>
      );
    case "numberData":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M9 4 7.4 20" />
          <path d="M16.6 4 15 20" />
          <path d="M5 9h14" />
          <path d="M4 15h14" />
        </svg>
      );
    case "preview":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M3.8 12s2.8-5.2 8.2-5.2 8.2 5.2 8.2 5.2-2.8 5.2-8.2 5.2S3.8 12 3.8 12Z" />
          <circle cx="12" cy="12" r="2.4" />
        </svg>
      );
    case "folder":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M3.8 7.4a2 2 0 0 1 2-2h4l2 2h6.4a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2Z" />
          <path d="M4 10h16" />
        </svg>
      );
    case "textData":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M5 6h14" />
          <path d="M12 6v12" />
          <path d="M8 18h8" />
        </svg>
      );
    case "promptDetached":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M8.8 9.2 7.2 7.6a3 3 0 0 0-4.2 4.2l2 2a3 3 0 0 0 4.1.1" />
          <path d="M15.2 14.8 16.8 16.4a3 3 0 0 0 4.2-4.2l-2-2a3 3 0 0 0-4.1-.1" />
          <path d="m8 16 8-8" />
          <path d="m4 20 2-2" />
          <path d="m18 6 2-2" />
        </svg>
      );
    case "promptAttached":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M9.6 8.4 8.1 6.9a3.2 3.2 0 0 0-4.5 4.5l2.3 2.3a3.2 3.2 0 0 0 4.5 0l.8-.8" />
          <path d="m14.4 15.6 1.5 1.5a3.2 3.2 0 0 0 4.5-4.5l-2.3-2.3a3.2 3.2 0 0 0-4.5 0l-.8.8" />
          <path d="m9 15 6-6" />
          <path d="M7.8 3.8v2.6" />
          <path d="M3.8 7.8h2.6" />
        </svg>
      );
    case "moreTools":
      return (
        <svg {...baseSvgProps} fill="currentColor">
          {title ? <title>{title}</title> : null}
          <path d="M21.7 6.3a6.8 6.8 0 0 1-8.6 8.6l-7 7a2.6 2.6 0 0 1-3.7-3.7l7-7A6.8 6.8 0 0 1 18 2.6l-3.4 3.4 1.2 3.1 3.1 1.2 3.4-3.4c-.1-.2-.3-.4-.6-.6Z" />
        </svg>
      );
    case "market":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M4.5 10h15l-1.2-4.5H5.7L4.5 10Z" />
          <path d="M5.3 10v8.5h13.4V10" />
          <path d="M9 18.5v-5h6v5" />
          <path d="M4.5 10c.4 1.2 1.4 2 2.7 2s2.3-.8 2.7-2c.4 1.2 1.4 2 2.7 2s2.3-.8 2.7-2c.4 1.2 1.4 2 2.7 2s2.3-.8 2.7-2" />
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
    case "edit":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M5 19h4.2L18.6 9.6a2.1 2.1 0 0 0-3-3L6.2 16 5 19Z" />
          <path d="m13.8 8.4 3 3" />
          <path d="M4 21h16" />
        </svg>
      );
    case "save":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <path d="M5 4h11l3 3v13H5Z" />
          <path d="M8 4v6h7V4" />
          <path d="M8 20v-6h8v6" />
        </svg>
      );
    case "search":
      return (
        <svg {...baseSvgProps} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {title ? <title>{title}</title> : null}
          <circle cx="10.5" cy="10.5" r="5.8" />
          <path d="m15 15 4.2 4.2" />
        </svg>
      );
    default:
      return null;
  }
}

function LetterIcon({ letter, title }: { letter: string; title?: string }) {
  return (
    <span className="uiIconLetter" title={title}>
      {letter}
    </span>
  );
}
