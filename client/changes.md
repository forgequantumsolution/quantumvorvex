# Changes Log — Quantum Vorvex Frontend

All changes made in this session to the Quantum Vorvex frontend.

Folder: `quantumvorvex-main/client/`

---

## Objective

1. Disable the marketing landing page and make the login page the default view for unauthenticated users.
2. Redesign the login page to match the Quantum Kairoz login aesthetic (dark split-screen, glassmorphic card, gold `#b07d1a`, Cormorant Garamond + DM Sans + DM Mono fonts, pulsing "System Online" status, gold-bordered feature pills, uppercase sign-in button).
3. Use a real theme-appropriate hotel background image and the shared Kairoz logo.
4. Fix the "half-white" layout bug that was caused by Vorvex's global flex-row `#root` container.

---

## The "half-white, no background" bug

After the initial redesign the login page rendered only on the left half of the viewport and the right half showed the global cream body colour. Root cause:

```css
/* src/index.css */
body  { background: var(--main-bg) /* #f4f4f2 */; overflow: hidden; }
#root { display: flex; height: 100vh; overflow: hidden; }
```

`#root` is a flex-row container designed for the authenticated app shell (sidebar + main content). The login page (`<LoginPage />`) became a flex item that shrank to its intrinsic size instead of filling the viewport, and the cream body colour bled through the unoccupied space on the right.

**Fix** — in [LoginPage.css](src/components/auth/LoginPage.css) on `.login-page`:

```css
flex: 1 1 100%;
width: 100%;
min-width: 0;
min-height: 100vh;
min-height: 100dvh;
overflow: hidden;
```

This forces the login page to claim the full flex row regardless of the global `#root` setup. `index.css` is untouched — the authenticated-app flex layout continues to work as before.

---

## File changes

### `src/App.jsx`

Changes made earlier in this session:

- Commented out the `LandingPage` import (`// import LandingPage from './components/auth/LandingPage'`) — landing component preserved on disk, just unreferenced.
- Commented out the `page === 'landing'` branch that rendered `<LandingPage onLogin={...} />`.
- Removed the `[page, setPage]` state declaration; left a one-line comment marker in its place.
- `<LoginPage />` now renders unconditionally for unauthenticated users, with no `onBack` prop.

### `src/components/auth/LoginPage.jsx` (rewritten, then refined)

Rewritten earlier in this session to mirror Kairoz's `LoginPage.tsx` structure; refined in this pass to add the logo and the real background image:

- Split-screen layout: left brand panel + right floating glass card.
- Inline Lucide-spec SVG icons (`MailIcon`, `LockIcon`, `EyeIcon`, `EyeOffIcon`, `AlertIcon`). `lucide-react` is **not** a Vorvex dependency, so icons are inlined as small SVG components to avoid adding a new package.
- **Added**: `import hotelBg from '../../assets/hotel-bg.jpg'`.
- **Added**: `import goldenLogo from '../../assets/golden_blue_logo.png'`.
- **Changed**: root element now `<div className="login-page" style={{ backgroundImage: url(${hotelBg}) }}>`. The provisional `login-page--vorvex` gradient class was dropped.
- **Changed**: card header now shows the Kairoz logo (`<img className="login-card-logo" ...>`) instead of the provisional gold "Q" monogram tile.
- Left brand panel copy:
  - Eyebrow: "Hotel Management System".
  - Headline: "Seamless Operations. / _Intelligent Control._"
  - Description: unified command centre for rooms, guests, billing, housekeeping.
  - Feature pills: `Check-In`, `Billing`, `Housekeeping`, `Reports`, `AI Insights`.
- Preserves existing `authApi.login({ email, password })` call and `useStore.login(token, user)` action.
- Demo account quick-fill chips (Owner / Manager / Staff) preserved and styled as Kairoz-style bottom-of-card chips.
- The multi-step forgot-password modal from the original component was removed (separate feature surface; can be re-added as its own route later).

### `src/components/auth/LoginPage.css` (refined)

Cloned from Kairoz's `LoginPage.css` earlier in this session; refined in this pass:

- **Added layout-fix block** on `.login-page`: `flex: 1 1 100%; width: 100%; min-width: 0; min-height: 100dvh; overflow: hidden;` — see [The "half-white, no background" bug](#the-half-white-no-background-bug) above.
- **Removed** the provisional `.login-page--vorvex` CSS-gradient rule — the real image now provides the background.
- **Replaced** `.login-card-logo-mark` (gold "Q" monogram tile) with `.login-card-logo` — 340×160 with `brightness(1.3)` filter, matching Kairoz / Kaizen / Eyewall / Optimizer sizing.

### `index.html`

- Appended Cormorant Garamond, DM Sans, and DM Mono to the existing Google Fonts `<link>` tag (Playfair Display, Inter, Syne, JetBrains Mono were already loaded).
- No other changes.

### `src/assets/hotel-bg.jpg` (new asset)

Resort / hotel pool photograph with warm sunset tones and lounge chairs. 1920×1280, ~550 KB, downloaded from Unsplash. Used as the login background image. Fits Quantum Vorvex's hospitality / hotel-management scope.

### `src/assets/golden_blue_logo.png` (new asset)

Copied from `Quantum-Kairoz-main/frontend/src/assets/golden_blue_logo.png` — the same logo used on the Kairoz, Kaizen, Eyewall, and Optimizer login cards. 32 KB.

---

## Design parity with Kairoz

| Token | Value |
|---|---|
| Accent gold | `#b07d1a` (hover `#c9922a`) |
| Status green | `#16A34A` — pulsing dot, "System Online" |
| Error red | `#DC2626` — inline error banner |
| Card | `rgba(255,255,255,0.1)` + `backdrop-filter: blur(24px)` + inset gold glow + deep shadow |
| Overlay | `linear-gradient(105deg, rgba(5,5,12,0.82) 0%, rgba(8,8,18,0.75) 45%, rgba(5,5,12,0.60) 100%)` |
| Serif | Cormorant Garamond 700 (falls back to Playfair Display) |
| Sans | DM Sans 300/400/500/600/700 (falls back to Inter) |
| Mono | DM Mono 400/500 (falls back to JetBrains Mono) |
| Logo size | 340×160 with `filter: brightness(1.3)` |
| Card max-width | 520px desktop, 420px ≤ 768px |
| Breakpoint | 768px — left brand panel hidden below |

---

## Dependencies

No new dependencies installed. Icons are inlined rather than adding `lucide-react`.

---

## Verification performed

- `LoginPage.jsx`, `LoginPage.css` parse cleanly via `esbuild@0.23.1`.
- Import paths resolved:
  - `useStore` from `../../store/useStore` ✓
  - `authApi` from `../../api/client` ✓
  - `hotelBg` from `../../assets/hotel-bg.jpg` ✓
  - `goldenLogo` from `../../assets/golden_blue_logo.png` ✓
- Full `npm run build` / `npm run dev` was not run in this session.

---

## What was not changed

- `LandingPage.jsx` component and its assets are preserved on disk — just unreachable. Re-enable by uncommenting the `LandingPage` import and the `page === 'landing'` branch in `App.jsx` (you would also need to restore the `[page, setPage]` state).
- `src/index.css` was **not** modified — the global `body { background: var(--main-bg) }` and `#root { display: flex }` rules are retained because the authenticated-app shell depends on them. The login page handles the unusual parent layout on its own via the `.login-page` fix.
- No components outside of the login page were restyled.
- No authentication logic / API contract changed; only presentation, copy, assets, and the default unauthenticated view.
- The forgot-password flow is not in this redesign (can be re-added as a separate route/surface later).
