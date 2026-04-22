# Making Sketches Feel Alive

Static mockups are barely better than screenshots. Every interactive element in a sketch must respond to interaction.

## Required Interactivity

| Element | Must Have |
|---------|-----------|
| Buttons | Click handler with visible feedback (state change, animation, toast) |
| Forms | Input validation on blur, submit handler that shows success state |
| Lists | Add/remove items, empty state, populated state |
| Toggles/switches | Working toggle with visible state change |
| Tabs/nav | Click to switch content |
| Modals/drawers | Open/close with transition |
| Hover states | Every clickable element needs a hover effect |
| Dropdowns | Open/close, item selection |

## Transitions

Add `transition: all 0.15s ease` as a baseline to interactive elements. Subtle motion makes the sketch feel real and helps judge whether the interaction pattern works.

## Fake the Backend

If the sketch shows a "Save" button, clicking it should show a brief loading state then a success message. If it shows a search bar, typing should filter hardcoded results. The goal is to feel the full interaction loop, not just see the resting state.

## State Cycling

If the sketch has multiple states (empty, loading, populated, error), include buttons to cycle through them. Label each state clearly. This lets the user experience how the design handles different data conditions.

## Implementation

Use vanilla JS in inline `<script>` tags. No frameworks, no build step. Keep it simple:

```html
<script>
  // Toggle a panel
  document.querySelector('.panel-toggle').addEventListener('click', (e) => {
    e.target.closest('.panel').classList.toggle('collapsed');
  });
</script>
```
