import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import LowMemoryModal from "../index";
import type { LowMemoryStatus } from "@/utils/models/lowMemory";

jest.mock("phosphor-react-native", () => ({ Warning: () => null }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/utils/models/lowMemory", () => ({
  describeLowMemory: () => ({
    title: "RAM",
    advice: "Low memory",
    stats: { free: "2.6 GB", total: "7.6 GB", model: "4.6 GB" },
  }),
}));

it("offers no send override when RAM is insufficient and closes without sending", () => {
  const onClose = jest.fn();
  const screen = render(
    <LowMemoryModal
      status={{ loaded: false } as LowMemoryStatus}
      visible
      blocksSend
      onClose={onClose}
    />,
  );
  expect(screen.queryByText("models.low_memory.send_anyway")).toBeNull();
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.press(screen.getByText("رجوع دون إرسال"));
  expect(onClose).toHaveBeenCalledTimes(1);
});
