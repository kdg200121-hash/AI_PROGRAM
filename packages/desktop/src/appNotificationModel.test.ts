import { describe, expect, it } from "vitest";
import { createAppNotification } from "./appNotificationModel";

describe("appNotificationModel", () => {
  it("creates standard notifications without auto dismiss by default", () => {
    const notification = createAppNotification(
      { title: "업데이트 알림", message: "새 버전이 있습니다." },
      0
    );

    expect(notification.variant).toBe("standard");
    expect(notification.autoDismissMs).toBeUndefined();
  });

  it("creates compact save notifications that auto dismiss", () => {
    const notification = createAppNotification(
      { title: "저장되었습니다", message: "", variant: "save-toast", autoDismissMs: 2200 },
      0
    );

    expect(notification.variant).toBe("save-toast");
    expect(notification.autoDismissMs).toBe(2200);
  });
});
