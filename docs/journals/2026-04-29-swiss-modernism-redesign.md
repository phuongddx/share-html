# Swiss Modernism 2.0 Redesign — Complete

**Date**: 2026-04-29 18:30  
**Severity**: Low  
**Component**: Visual Design System  
**Status**: Resolved

## What Happened

Completed 6-phase visual redesign implementing Swiss Modernism principles across entire DropItX codebase. Replaced Ubuntu fonts with Inter + JetBrains Mono, updated OKLCH color tokens to zinc neutrals + violet primary + emerald success, enforced flat design (zero shadows), implemented 8px spacing grid and 1200px/680px two-tier max-width system. 65 files changed with 465 insertions, 443 deletions.

## The Brutal Truth

This was more exhausting than expected. The grep audit to eliminate hardcoded colors/shadows/gradient remnants was brutal — found 23 instances of lingering `rgb()` values and 7 inline styles that survived initial conversion. The Recharts component cleanup was particularly painful because SVG props don't support CSS custom properties, requiring manual JS hex constant extraction. Also discovered that CodeMirror theme needed separate CSS custom property treatment since it uses CSS-in-JS syntax.

## Technical Details

- **Font Migration**: Ubuntu → Inter (body), JetBrains Mono (code) - required font-weight mappings (400→400, 500→500, 700→600)
- **Color System**: OKLCH to hex constants: zinc neutrals (#f8f9fa → #e5e7eb), violet (#8b5cf6), emerald (#10b981)
- **Design Constraints**: Zero shadows, 8px grid, 1200px/680px max-widths
- **Component Updates**: All Recharts use JS hex constants, CodeMirror uses CSS custom properties
- **Build Status**: Passes, lint clean on changed files, no hardcoded values detected

## What We Tried

Initially tried CSS variable replacement with fallbacks, but SVG components in Recharts broke. Solution: extract hex constants to shared JS file and reference in SVG props. Also struggled with CodeMirror's CSS-in-JS syntax — ended up keeping CSS custom properties but with prefixed names to avoid conflicts.

## Root Cause Analysis

The main challenge was incomplete abstraction in the previous design system. Hardcoded values existed in multiple formats (CSS vars, inline styles, SVG props) making systematic replacement difficult. The two-tier max-width system required careful breakpoint calculations to maintain responsive behavior without media query bloat.

## Lessons Learned

1. **Global Design Systems Need Complete Abstraction**: Either use CSS variables everywhere or use JS constants everywhere — don't mix approaches
2. **SVG Components Require Special Handling**: Recharts and similar libraries need explicit hex values, can't use CSS custom properties
3. **Grep Audits Are Non-Negotiable**: Automated tools catch what manual conversion misses
4. **Font Migration Is More Than Font-Family**: Require weight mapping and potential fallback strategies
5. **CodeMirror Needs Special Treatment**: CSS-in-JS syntax requires different approach than standard CSS

## Next Steps

- Monitor for any hardcoded color remnants in production
- Document the new design system in component library
- Consider adding automated linting for CSS variable usage
- Plan for accessibility compliance with new color contrast ratios