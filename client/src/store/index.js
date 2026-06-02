import { combineReducers, configureStore } from '@reduxjs/toolkit'
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist'

import uiReducer from './slices/uiSlice'
import authReducer from './slices/authSlice'
import hotelReducer from './slices/hotelSlice'
import toastReducer from './slices/toastSlice'
import opsReducer from './slices/opsSlice'

// localStorage-backed storage for redux-persist. Defined inline (instead of
// importing `redux-persist/lib/storage`) to avoid a CJS/ESM interop issue where
// the default import resolves to the module namespace and `getItem` is missing.
const createWebStorage = () => ({
  getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
  setItem: (key, value) => Promise.resolve(window.localStorage.setItem(key, value)),
  removeItem: (key) => Promise.resolve(window.localStorage.removeItem(key)),
})

const createNoopStorage = () => ({
  getItem: () => Promise.resolve(null),
  setItem: (_key, value) => Promise.resolve(value),
  removeItem: () => Promise.resolve(),
})

const storage = typeof window !== 'undefined' ? createWebStorage() : createNoopStorage()

// Persist only `darkMode` from the ui slice (sidebar/activePanel/search are transient).
const uiPersistConfig = { key: 'qv-ui', storage, whitelist: ['darkMode', 'sidebarCollapsed'] }

const rootReducer = combineReducers({
  ui: persistReducer(uiPersistConfig, uiReducer),
  auth: authReducer,
  hotel: hotelReducer,
  toast: toastReducer, // never persisted
  ops: opsReducer,
})

// Persist auth (token, currentUser) and hotel (name, owner) — matches the old
// Zustand `qv-store` partializer. Toasts and transient ui are excluded.
const rootPersistConfig = { key: 'qv-store', storage, whitelist: ['auth', 'hotel', 'ops'] }

const persistedReducer = persistReducer(rootPersistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
})

export const persistor = persistStore(store)
