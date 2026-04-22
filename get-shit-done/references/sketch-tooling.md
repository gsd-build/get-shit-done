# Sketch Toolbar

Include a small floating toolbar in every sketch. It provides utilities without competing with the actual design.

## Implementation

A small `<div>` fixed to the bottom-right, semi-transparent, expands on hover:

```html
<div id="sketch-tools" style="position:fixed;bottom:12px;right:12px;z-index:9999;font-family:system-ui;font-size:12px;background:rgba(0,0,0,0.7);color:white;padding:8px 12px;border-radius:8px;opacity:0.4;transition:opacity 0.2s;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.4'">
  <!-- Theme switcher -->
  <!-- Viewport buttons -->
  <!-- Annotation toggle -->
</div>
```

## Components

### Theme Switcher

A dropdown that swaps the theme CSS file at runtime:

```html
<select onchange="document.querySelector('link[href*=themes]').href='../themes/'+this.value+'.css'">
  <option value="default">Default</option>
</select>
```

### Viewport Preview

Three buttons that constrain the sketch content area to standard widths:

- Phone: 375px
- Tablet: 768px
- Desktop: 1280px (or full width)

Implemented by wrapping sketch content in a container and adjusting its `max-width`.

### Annotation Mode

A toggle that overlays spacing values, color hex codes, and font sizes on hover. Implemented as a JS snippet that reads computed styles and shows them in a tooltip. Helps understand visual decisions without opening dev tools.

## Styling

The toolbar should be unobtrusive — small, dark, semi-transparent. It should never compete with the sketch visually. Style it independently of the theme (hardcoded dark background, white text).
