import { Provider } from '@angular/core';
import { KeyValueStore, SETTINGS_STORE } from '../app/core/settings/settings.service';

/** In-memory settings storage; `data` is exposed so tests can seed or inspect it. */
export function memoryStore(data = new Map<string, string>()): KeyValueStore & {
  data: Map<string, string>;
} {
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
  };
}

export function provideMemorySettings(store = memoryStore()): Provider {
  return { provide: SETTINGS_STORE, useValue: store };
}
