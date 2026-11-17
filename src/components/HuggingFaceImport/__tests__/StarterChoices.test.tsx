import React from "react";
import { Linking } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import StarterChoices from "../StarterChoices";

jest.mock("@/utils/api/hfGguf", () => ({
  hfRepoWebUrl: (id: string) => `https://huggingface.co/${id}`,
}));

describe("model discovery", () => {
  it("opens the selected repository inside the app without opening a browser", () => {
    const onOpen = jest.fn();
    const external = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined);
    const screen = render(<StarterChoices onOpen={onOpen} />);
    fireEvent.press(screen.getByLabelText("عرض ملفات كوين خفيف · Qwen 0.8B"));
    expect(onOpen).toHaveBeenCalledWith("unsloth/Qwen3.5-0.8B-GGUF");
    expect(external).not.toHaveBeenCalled();
    external.mockRestore();
  });

  it("opens the Google model GGUF publisher page rather than starting a download", async () => {
    const onOpen = jest.fn();
    const external = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined);
    const screen = render(<StarterChoices onOpen={onOpen} />);
    fireEvent.press(
      screen.getByLabelText("فتح مصدر جيما من Google · Gemma 3 1B"),
    );
    await waitFor(() =>
      expect(external).toHaveBeenCalledWith(
        "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF",
      ),
    );
    expect(onOpen).not.toHaveBeenCalled();
    external.mockRestore();
  });

  it("keeps an in-app path available when no browser can open the source", async () => {
    const external = jest
      .spyOn(Linking, "openURL")
      .mockRejectedValue(new Error("no browser"));
    const screen = render(<StarterChoices onOpen={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("فتح مصدر كوين أكبر · Qwen 2B"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByLabelText("عرض ملفات كوين أكبر · Qwen 2B")).toBeTruthy();
    external.mockRestore();
  });
});
