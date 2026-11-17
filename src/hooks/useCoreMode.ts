import { useEffect, useState } from "react";
import uiStore from "@/store/UIStore";

/** A deliberate user choice, independent of the enabled-tool preferences. */
export default function useCoreMode() {
  const [quick, setQuick] = useState(false);
  useEffect(() => {
    let live = true;
    uiStore.getFromStorage("core_quick_chat", false).then(value => {
      if (live) setQuick(value);
    });
    const listener = uiStore.emitter.addListener(
      "core_quick_chat",
      ({ details }) => setQuick(details === true),
    );
    return () => {
      live = false;
      listener.remove();
    };
  }, []);
  return {
    quick,
    setQuick: async (value: boolean) => {
      await uiStore.setToStorage("core_quick_chat", value);
    },
  };
}
