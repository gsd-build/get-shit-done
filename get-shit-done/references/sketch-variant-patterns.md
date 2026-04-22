# Multi-Variant HTML Patterns

Every sketch produces 2-3 variants in the same HTML file. The user switches between them to compare.

## Tab-Based Variants

The standard approach: a tab bar at the top of the page, each tab shows a different variant.

```html
<div id="variant-nav" style="position:fixed;top:0;left:0;right:0;z-index:9998;background:var(--color-surface, #fff);border-bottom:1px solid var(--color-border, #e5e5e5);padding:8px 16px;display:flex;gap:8px;font-family:system-ui;">
  <button class="variant-tab active" onclick="showVariant('a')">A: Sidebar Layout</button>
  <button class="variant-tab" onclick="showVariant('b')">B: Top Nav</button>
  <button class="variant-tab" onclick="showVariant('c')">C: Floating Panels</button>
</div>

<div id="variant-a" class="variant active">
  <!-- Variant A content -->
</div>
<div id="variant-b" class="variant" style="display:none">
  <!-- Variant B content -->
</div>
<div id="variant-c" class="variant" style="display:none">
  <!-- Variant C content -->
</div>

<script>
function showVariant(id) {
  document.querySelectorAll('.variant').forEach(v => v.style.display = 'none');
  document.querySelectorAll('.variant-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('variant-' + id).style.display = 'block';
  event.target.classList.add('active');
}
</script>
```

Add `padding-top` to the body to account for the fixed tab bar.

## Marking the Winner

After the user picks a direction, add a visual indicator to the winning tab:

```html
<button class="variant-tab active">A: Sidebar Layout ★ Selected</button>
```

Keep all variants visible and navigable — the winner is highlighted, not the only option.

## Side-by-Side (for small variants)

When comparing small elements (button styles, card layouts, icon treatments), render them next to each other with labels rather than using tabs:

```html
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:24px;">
  <div>
    <h3>A: Rounded</h3>
    <!-- variant content -->
  </div>
  <div>
    <h3>B: Sharp</h3>
    <!-- variant content -->
  </div>
  <div>
    <h3>C: Pill</h3>
    <!-- variant content -->
  </div>
</div>
```

## Variant Count

- **First round (dramatic):** 2-3 meaningfully different approaches
- **Refinement rounds:** 2-3 subtle variations within the chosen direction
- **Never more than 4** — more than that overwhelms. If there are 5+ options, narrow before showing.

## Synthesis Variants

When the user cherry-picks elements across variants, create a new variant tab labeled descriptively:

```html
<button class="variant-tab" onclick="showVariant('synth1')">Synthesis: A's layout + C's palette</button>
```
