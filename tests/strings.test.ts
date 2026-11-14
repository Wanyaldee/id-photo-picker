import { expect, test } from "vite-plus/test";
import { strings } from "../src/ui/strings";

// README and the UI both promise this; keep the promise visible on screen.
test("privacy and usage notices are present", () => {
  expect(strings.privacyNote).toContain("端末の外に出ません");
  expect(strings.usageNote).toContain("履歴書");
});
