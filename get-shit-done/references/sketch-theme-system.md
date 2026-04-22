# Shared Theme System

All sketches share a CSS variable theme so design decisions compound across sketches.

## Setup

On the first sketch, create `.planning/sketches/themes/` with a default theme:

```
.planning/sketches/
  themes/
    default.css         <- all sketches link to this
  001-dashboard-layout/
    index.html          <- links to ../themes/default.css
```

## Theme File Structure

Each theme defines CSS custom properties only — no component styles, no layout rules. Just the visual vocabulary:

```css
:root {
  /* Colors */
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-border: #e5e5e5;
  --color-text: #1a1a1a;
  --color-text-muted: #6b6b6b;
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-accent: #f59e0b;
  --color-danger: #ef4444;
  --color-success: #22c55e;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* Shapes */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}
```

Adapt the default theme to match the mood/direction established during intake. The values above are a starting point — change colors, fonts, spacing, and shapes to match the agreed aesthetic.

## Linking

Every sketch links to the theme:

```html
<link rel="stylesheet" href="../themes/default.css">
```

## Creating New Themes

When a sketch reveals an aesthetic fork ("should this feel clinical or warm?"), create both as theme files rather than arguing about it. The user can switch and feel the difference.

Name themes descriptively: `midnight.css`, `warm-minimal.css`, `brutalist.css`.

## Theme Switcher

Include in every sketch (part of the sketch toolbar):

```html
<select id="theme-switcher" onchange="document.querySelector('link[href*=themes]').href='../themes/'+this.value+'.css'">
  <option value="default">Default</option>
</select>
```

Dynamically populate options by listing available theme files, or hardcode the known themes.
