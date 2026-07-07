export type AppNotificationVariant = "standard" | "save-toast";

export interface AppNotificationInput {
  title: string;
  message: string;
  variant?: AppNotificationVariant;
  autoDismissMs?: number;
}

export interface AppNotificationItem extends AppNotificationInput {
  id: string;
  variant: AppNotificationVariant;
}

export function createAppNotification(
  notification: AppNotificationInput,
  index: number,
  now = Date.now()
): AppNotificationItem {
  return {
    ...notification,
    id: `${now}-${index}`,
    variant: notification.variant ?? "standard"
  };
}
