import type { ReactNode } from "react";
import { AppIcon, type AppIconName } from "./uiIcons";

interface PanelHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  iconName?: AppIconName;
  action?: ReactNode;
}

export function PanelHeader({ title, description, iconName, action }: PanelHeaderProps) {
  return (
    <div className="panelHeader">
      {iconName ? <AppIcon name={iconName} className="panelHeaderIcon" /> : null}
      <div>
        <h2>{title}</h2>
        {description ? <span className="panelHeaderNote">{description}</span> : null}
      </div>
      {action}
    </div>
  );
}
