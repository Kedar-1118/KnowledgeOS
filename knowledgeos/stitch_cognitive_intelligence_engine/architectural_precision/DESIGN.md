---
name: Architectural Precision
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d8'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#918fa1'
  outline-variant: '#464555'
  surface-tint: '#c3c0ff'
  primary: '#c3c0ff'
  on-primary: '#1d00a5'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#4d44e3'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#885500'
  on-tertiary-container: '#ffd4a4'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-xl:
    fontFamily: Geist
    fontSize: 72px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  code:
    fontFamily: jetbrainsMono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is built on a foundation of **Architectural Minimalism**, blending the technical rigor of developer-centric tools with the refined elegance of luxury consumer electronics. It targets high-performance teams who value intentionality, speed, and focus.

The aesthetic is characterized by:
- **Precision:** Mathematical alignment and a strict adherence to a logic-driven grid.
- **Depth:** Using light and shadow as functional cues rather than decoration, creating a clear physical hierarchy.
- **Subtlety:** Low-contrast borders and micro-interactions that reward exploration without demanding attention.
- **Materiality:** A "Digital Glass" approach where surfaces have weight, translucency, and varied finishes (frosted, polished, or matte).

## Colors

The palette is optimized for a high-end dark mode experience, emphasizing depth through a cool-toned grayscale.

- **Primary (Indigo-Violet):** Used for primary actions, focus states, and key brand moments. It represents intelligence and reliability.
- **Grayscale (Slate-Tinted):** Neutrals are infused with 2-4% blue/indigo to maintain a premium "cool" temperature, avoiding the flatness of pure black or gray.
- **Glass & Borders:** Surfaces use semi-transparent backgrounds with a 1px border that mimics a subtle light catch on a physical edge.
- **Gradients:** Use mesh gradients sparingly. The primary gradient moves from `#4F46E5` to `#818CF8` with a 30% opacity radial blur for background highlights.

## Typography

Typography is the primary driver of the system's "Architectural" feel. 

- **Geist** is used for structural elements, headings, and labels. Its technical precision creates a "tooled" look.
- **Inter** is used for body copy and long-form data reading due to its exceptional legibility and neutral character.
- **Tracking:** High-impact headings (Display XL-LG) must use tight tracking (-3% to -4%) to feel cohesive and intentional.
- **Leading:** Body text utilizes a generous 1.6x line height to ensure readability in data-dense SaaS environments.

## Layout & Spacing

The system employs a strict **8pt Grid** to ensure vertical and horizontal rhythm. 

- **Grid Model:** A 12-column fluid grid for desktop with 24px gutters. For dashboards, use a fixed left-rail navigation (240px) with a fluid content area.
- **Density:** Provide three density modes: Compact (for data tables), Default (for standard forms), and Spacious (for marketing or empty states).
- **Alignment:** All components must align to the baseline. Icons are centered within 16px, 20px, or 24px square bounding boxes to maintain optical balance.

## Elevation & Depth

This design system uses a **Tonal Layering** approach combined with **Glassmorphism** for a premium feel.

- **Level 0 (Base):** Deepest background (`#020617`). No shadow.
- **Level 1 (Card/Surface):** Elevation created by a 1px border (`rgba(255, 255, 255, 0.08)`) and a slight surface color shift.
- **Level 2 (Popovers/Dropdowns):** Utilizes Backdrop Blur (20px) with a semi-transparent fill (`rgba(15, 23, 42, 0.8)`). 
- **Shadows:** Multi-layered shadows are used only for floating elements.
  - *Shadow Example:* `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`.
- **Glows:** Primary buttons and active states feature a very subtle 8px outer glow using the primary indigo color at 15% opacity to simulate a light-emitting interface.

## Shapes

The shape language is refined and consistent. We use **Rounded (2)** as the default to soften the technical nature of the typography.

- **Small Components:** Checkboxes and small tags use `rounded-sm` (4px).
- **Standard Components:** Buttons, inputs, and list items use `rounded-md` (8px).
- **Containers:** Cards and modals use `rounded-lg` (16px) or `rounded-xl` (24px) to create a distinct nesting hierarchy where the inner corner radius is always smaller than the outer corner radius.

## Components

- **Buttons:** 
  - *Primary:* Solid Indigo-Violet background, white text. No gradient, but a 1px top-border highlight.
  - *Secondary:* Ghost style with 1px border. On hover, the background fills to 10% opacity white.
- **Inputs:** Darker than the surface color, 1px border. Focus state uses a 1px primary border with a 2px outer glow. Labels are always `label-sm` and positioned above the field.
- **Chips:** Highly rounded (pill), low-contrast backgrounds with high-contrast text. Use for status indicators (Success = Emerald, Warning = Amber).
- **Cards:** 1px border, no shadow unless hovered. Background has a subtle radial gradient from top-left to bottom-right to create "sheen."
- **Navigation:** Use Glassmorphism for the sidebar and top-bar. Active links are indicated by a subtle vertical bar on the left and a 5% opacity white background fill.
- **Status Indicators:** Use a "pulse" animation on a 6px dot for live-data status (e.g., green pulse for "Connected").