import { NativeModules, Platform } from "react-native";
import { v4 as uuid } from "uuid";
import uiStore from "@/store/UIStore";

export type SharedModel = {
  uri: string;
  name: string;
  size: number;
  modelId: string;
};
const native = () => {
  if (Platform.OS !== "android" || !NativeModules.SharedModelLibrary)
    throw new Error("مكتبة المجلدات متاحة على أندرويد فقط");
  return NativeModules.SharedModelLibrary;
};
export const SharedLibrary = {
  folder: (): Promise<string | null> => native().folder(),
  chooseFolder: (): Promise<string | null> => native().chooseFolder(),
  list: (): Promise<SharedModel[]> =>
    uiStore.getFromStorage<SharedModel[]>("core_shared_models", []),
  async remember(file: Omit<SharedModel, "modelId">): Promise<SharedModel> {
    const models = await SharedLibrary.list();
    const existing = models.find(m => m.uri === file.uri);
    const model = {
      ...file,
      modelId: existing?.modelId ?? `shared/${uuid()}/${file.name}`,
    };
    await uiStore.setToStorage("core_shared_models", [
      ...models.filter(m => m.uri !== file.uri),
      model,
    ]);
    return model;
  },
  async link(): Promise<SharedModel | null> {
    const file = await native().chooseModel();
    return file ? SharedLibrary.remember(file) : null;
  },
  async scan(): Promise<void> {
    for (const file of await native().scan())
      await SharedLibrary.remember(file);
  },
  async download(
    url: string,
    name: string,
    bytes: number,
  ): Promise<SharedModel> {
    return SharedLibrary.remember(await native().download(url, name, bytes));
  },
  cancel: () => native().cancelTransfer(),
  async open(modelId: string): Promise<string> {
    const model = (await SharedLibrary.list()).find(m => m.modelId === modelId);
    if (!model) throw new Error("النموذج غير مرتبط بالمكتبة؛ أعد اختيار الملف");
    return native().openModel(model.uri);
  },
  async forget(modelId: string): Promise<void> {
    await uiStore.setToStorage(
      "core_shared_models",
      (await SharedLibrary.list()).filter(m => m.modelId !== modelId),
    );
  },
};
