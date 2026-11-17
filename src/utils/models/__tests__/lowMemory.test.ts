import { NativeModules } from "react-native";
import OnDeviceProvider from "@/utils/AiProviders/onDevice";
import { claimLowMemoryWarning } from "../lowMemory";

jest.mock("@/utils/AiProviders/onDevice", () => ({
  __esModule: true,
  default: class {
    memoryProfile = jest.fn();
  },
}));
jest.mock("@/utils/formatters", () => ({ formatBytes: String }));
jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

it("rechecks every send, continues blocking after dismissal, and allows recovery", async () => {
  const read = jest
    .fn()
    .mockResolvedValue({ total: 7.6e9, available: 2.6e9, lowMemory: false });
  NativeModules.DeviceInfoModule = { getMemoryInfo: read };
  const provider = Object.create(OnDeviceProvider.prototype);
  provider.memoryProfile = jest
    .fn()
    .mockResolvedValue({
      loaded: false,
      estimate: { weights: 3.8e9, total: 4.6e9 },
    });
  expect(await claimLowMemoryWarning(provider)).not.toBeNull();
  expect(await claimLowMemoryWarning(provider)).not.toBeNull();
  read.mockResolvedValue({ total: 7.6e9, available: 5.1e9, lowMemory: false });
  expect(await claimLowMemoryWarning(provider)).toBeNull();
  expect(read).toHaveBeenCalledTimes(3);
});
