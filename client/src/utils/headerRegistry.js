/**
 * Click handlers and icons for the page header. Redux holds only plain data
 * (store/slices/pageHeaderSlice.js); the functions and icon elements behind each
 * action id live here, keyed `${owner}:${id}`, so the store stays serializable.
 */
const entries = new Map()

const key = (owner, id) => `${owner}:${id}`

export const setEntry = (owner, id, entry) => entries.set(key(owner, id), entry)
export const getEntry = (owner, id) => entries.get(key(owner, id)) || {}

export const clearOwner = (owner) => {
  const prefix = `${owner}:`
  for (const k of entries.keys()) if (k.startsWith(prefix)) entries.delete(k)
}

let lastOwner = 0
export const nextOwner = () => `h${++lastOwner}`
