import uiStore from '@/store/UIStore';
import { HfGGUFQuant, HfGGUFRepoSummary } from '@/utils/api/hfGguf';
import i18n from '@/i18n';

/**
 * GGUF model references added outside the built-in catalog.
 *
 * Hugging Face models use an `org/repo/file.gguf` id and app-private downloaded path.
 * SAF models store a content URI and are opened through a native file-descriptor lease;
 * removing their list entry never deletes the user's original shared document.
 */
export type ImportedModel = {
  /** `org/repo/file.gguf` */
  modelId: string;
  /** `org/repo` */
  repoId: string;
  filename: string;
  quant: string | null;
  name: string;
  description: string;
  /** File size in bytes */
  size: number;
  downloadUrl: string;
  /** Hugging Face author/org, shown as the provider group */
  author: string;
  architecture?: string;
  params?: number;
  contextLength?: number;
  /** ISO date the user added it */
  addedAt: string;
  /** SAF models reference a user-owned document; legacy Hugging Face records omit this field. */
  source?: 'huggingface' | 'saf';
  contentUri?: string;
};

export const IMPORTED_MODELS_STORAGE_KEY = 'hf_imported_models' as const;

export function importedModelId(repoId: string, filename: string) {
  return `${repoId}/${filename}`;
}

/**
 * List description for an imported model, in the current UI language. Built when the list is shown
 * (see OnDeviceProvider.availableModels) so it follows language changes after the model was added.
 */
export function describeImportedModel(model: { repoId: string; architecture?: string; contextLength?: number }): string {
  const specs = [
    model.architecture,
    model.contextLength ? i18n.t('hf_import.context', { value: Math.round(model.contextLength / 1024) }) : null,
  ].filter(Boolean).join(' · ');
  return specs
    ? i18n.t('models.imported_description_specs', { repo: model.repoId, specs })
    : i18n.t('models.imported_description', { repo: model.repoId });
}

export function buildImportedModel(repo: HfGGUFRepoSummary, quant: HfGGUFQuant): ImportedModel {
  const quantLabel = quant.quant ? ` (${quant.quant})` : '';

  return {
    modelId: importedModelId(repo.id, quant.filename),
    repoId: repo.id,
    filename: quant.filename,
    quant: quant.quant,
    name: `${repo.title}${quantLabel}`,
    description: describeImportedModel({ repoId: repo.id, architecture: repo.architecture, contextLength: repo.contextLength }),
    size: quant.size,
    downloadUrl: quant.downloadUrl,
    author: repo.author,
    source: 'huggingface',
    architecture: repo.architecture,
    params: repo.params,
    contextLength: repo.contextLength,
    addedAt: new Date().toISOString(),
  };
}

const ImportedModels = {
  async list(): Promise<ImportedModel[]> {
    const models = await uiStore.getFromStorage<ImportedModel[]>(IMPORTED_MODELS_STORAGE_KEY, []);
    return Array.isArray(models) ? models : [];
  },

  async has(modelId: string): Promise<boolean> {
    const models = await ImportedModels.list();
    return models.some(m => m.modelId === modelId);
  },

  async find(modelId: string): Promise<ImportedModel | undefined> {
    const models = await ImportedModels.list();
    return models.find(model => model.modelId === modelId);
  },

  /** Adds (or replaces) an imported model definition. */
  async add(model: ImportedModel): Promise<ImportedModel[]> {
    const models = (await ImportedModels.list()).filter(m => m.modelId !== model.modelId);
    models.push(model);
    await uiStore.setToStorage(IMPORTED_MODELS_STORAGE_KEY, models);
    return models;
  },

  async remove(modelId: string): Promise<ImportedModel[]> {
    const models = (await ImportedModels.list()).filter(m => m.modelId !== modelId);
    await uiStore.setToStorage(IMPORTED_MODELS_STORAGE_KEY, models);
    return models;
  },
};

export default ImportedModels;
