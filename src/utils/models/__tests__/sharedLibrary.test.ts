jest.mock('uuid', () => ({ v4: () => 'test-model-id' }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, NativeModules: { SharedModelLibrary: { chooseModel: jest.fn(), openModel: jest.fn(), scan: jest.fn() } } }));
jest.mock('@/store/UIStore', () => ({ __esModule: true, default: { getFromStorage: jest.fn(), setToStorage: jest.fn() } }));
import uiStore from '@/store/UIStore';
import { NativeModules } from 'react-native';
import { SharedLibrary, type SharedModel } from '../sharedLibrary';
const bridge = NativeModules.SharedModelLibrary;
let saved: SharedModel[];
beforeEach(() => {
  saved = []; jest.clearAllMocks();
  (uiStore.getFromStorage as jest.Mock).mockImplementation(async () => saved);
  (uiStore.setToStorage as jest.Mock).mockImplementation(async (_key, value) => { saved = value; });
});
test('relinking a URI preserves identity and never duplicates its entry', async () => {
  const file = { uri: 'content://local/123', name: 'Qwen.gguf', size: 812000000 };
  const first = await SharedLibrary.remember(file);
  const again = await SharedLibrary.remember({ ...file, size: 812000001 });
  expect(again.modelId).toBe(first.modelId);
  expect(saved).toHaveLength(1);
  expect(saved[0].size).toBe(812000001);
});
test('cancelled picker does not create a model or copy anything', async () => {
  bridge.chooseModel.mockResolvedValue(null);
  expect(await SharedLibrary.link()).toBeNull();
  expect(uiStore.setToStorage).not.toHaveBeenCalled();
});
test('opening resolves the saved URI directly with no private file copy', async () => {
  const model = await SharedLibrary.remember({ uri: 'content://local/321', name: 'model.gguf', size: 500 });
  bridge.openModel.mockResolvedValue('/proc/self/fd/42');
  expect(await SharedLibrary.open(model.modelId)).toBe('/proc/self/fd/42');
  expect(bridge.openModel).toHaveBeenCalledWith('content://local/321');
});
test('forgetting removes only the registry entry and missing models cannot open', async () => {
  const model = await SharedLibrary.remember({ uri: 'content://local/321', name: 'model.gguf', size: 500 });
  await SharedLibrary.forget(model.modelId);
  expect(saved).toEqual([]);
  await expect(SharedLibrary.open(model.modelId)).rejects.toThrow('أعد اختيار الملف');
  expect(bridge.openModel).not.toHaveBeenCalled();
});
