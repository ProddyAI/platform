# Tooltip Hover Positioning Fix - Complete Analysis & Solution

## Root Cause Analysis

### Problem Symptoms
- Tooltips "fly" or drift to the right when hovering
- Horizontal offset accumulation in line charts
- Tooltips overflow off-screen edges
- Inconsistent positioning across different chart types
- Jitter on hover due to recalculations

### Technical Root Causes

#### 1. **Mixed Coordinate Systems**
```tsx
// BEFORE (Line Chart) - SVG units mixed with calculations
transform={`translate(${Math.max(chartMargin + 15, Math.min(100 - chartMargin - 15, point.x))}, 
  ${Math.max(chartMargin + 20, point.y - 10)})`}
```
**Problem:** The `Math.min` and `Math.max` for X coordinate attempted to center, but failed to account for tooltip width, causing horizontal drift.

#### 2. **No Consistent Viewport Bounds Checking**
```tsx
// BEFORE (Pie Chart) - Pixel-based offsets without bounds
style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
```
**Problem:** SVG coordinate system (0-100) doesn't match pixel units. Offset calculations didn't prevent overflow.

#### 3. **Reactive State Without Proper Positioning**
```tsx
// BEFORE (Bar Chart) - Absolute positioning without containment
className="absolute -top-6 text-xs font-medium"
```
**Problem:** Hardcoded negative top values don't account for container bounds. No logic to prevent off-screen rendering.

#### 4. **Duplicate Coordinate Transformations**
Multiple `Math.max/Math.min` operations in cascade → cumulative errors and drift.

---

## Solution Implementation

### 1. **Centralized Tooltip Positioning Utility**
**File:** `src/features/reports/utils/tooltip-positioning.ts`

```typescript
/**
 * Unified approach:
 * - Single source of truth for all positioning logic
 * - Works in normalized SVG units (0-100) for SVG charts
 * - Works in DOM pixel units for non-SVG charts
 * - Viewport boundary checking built-in
 * - No mixed coordinate systems
 */
```

**Key Features:**
- **Standardized SVG Positioning**: All values in SVG viewBox units (0-100)
- **Symmetrical Centering**: `x = pointX - tooltipWidth/2` (not `Math.min/max`)
- **Discrete Boundary Checking**: Independent left, right, top, bottom checks
- **Smart Fallback**: Tooltips reposition below if insufficient space above
- **No Drift**: Single `translate()` operation instead of multiple nested transforms

### 2. **Line Chart Fix**
**Changes:**
- Removed complex `Math.max(chartMargin + 15, Math.min(...))` calculations
- Imported `calculateSvgTooltipPosition` utility
- Passes normalized SVG coordinates (0-100)
- Uses `getTooltipRectAttrs()` and `getTooltipTextAttrs()` for consistency

**Before vs After:**
```tsx
// BEFORE: Multiple calculations, mixed concerns
transform={`translate(${Math.max(...Math.min(...point.x...))}, ...)`}

// AFTER: Single, deterministic calculation
const tooltipPos = calculateSvgTooltipPosition({...});
g transform={tooltipPos.transform}
```

### 3. **Bar Chart Fix**
**Changes:**
- Added `useRef` to track container element
- Added `useEffect` to recalculate position on hover state changes
- Uses `calculateDomTooltipPosition` for DOM-based positioning
- Tooltip moved outside bar loop to fixed position container
- Proper `z-50` to prevent overlap

**Key Improvement:**
```tsx
// BEFORE: Hardcoded -top-6, relies on CSS cascade
className="absolute -top-6"

// AFTER: Dynamic positioning based on actual container bounds
const pos = calculateDomTooltipPosition(element, containerRect, width, height, offsetY);
style={{ top: pos.top, left: pos.left }}
```

### 4. **Pie Chart Fix**
**Changes:**
- Removed pixel-based SVG transforms
- Integrated `calculateSvgTooltipPosition` for tooltip placement
- Tooltips positioned radially from pie segments
- Uses brightness filter instead of pixel transforms for hover effect

**Advantage:**
```tsx
// BEFORE: Pixel transforms on SVG (mixing coordinate systems)
style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}

// AFTER: All SVG units, consistent positioning
const tooltipPos = calculateSvgTooltipPosition({...});
g transform={tooltipPos.transform}
```

---

## Technical Architecture

### Coordinate System Unification
```
SVG Charts (Line, Pie):
  - All coordinates in viewBox units (0-100)
  - Single coordinate system throughout
  - translateX/Y operations work predictably

DOM Charts (Bar, Horizontal):
  - All coordinates in pixels (relative to container)
  - getBoundingClientRect() for element bounds
  - Consistent pixel-based math
```

### Tooltip Positioning Algorithm
```
1. Place tooltip at offset from data point
2. Center horizontally: x - (width / 2)
3. Check left boundary: if x < padding → x = padding
4. Check right boundary: if x + width > max → shift left
5. Check top boundary: if y < padding → place below instead
6. Check bottom boundary: if y + height > max → shift up
7. Render with single transform (SVG) or style (DOM)
```

### Boundary Safety
- **5px padding** from chart edges by default
- **Configurable** per chart type via `padding` parameter
- **Smart fallback** for tooltip placement (above → below)
- **Prevented overflow** in all directions

---

## Benefits

✅ **No More Drift** - Single transform operation, no cascading calculations
✅ **Consistent** - Same logic across all chart types
✅ **Responsive** - Respects container bounds dynamically
✅ **Maintainable** - Centralized utility, easy to update
✅ **Predictable** - Deterministic positioning based on rules
✅ **Accessible** - Proper z-index and pointer-events handling
✅ **Performant** - Minimal recalculations via useEffect
✅ **Reusable** - Any future chart can use same utilities

---

## Migration Guide for New Charts

### For SVG Charts:
```tsx
import { calculateSvgTooltipPosition, getTooltipRectAttrs } from '@/features/reports/utils/tooltip-positioning';

// In render:
const tooltipPos = calculateSvgTooltipPosition({
  viewBoxWidth: 100,
  viewBoxHeight: 100,
  tooltipWidth: 36,
  tooltipHeight: 18,
  pointX: point.x,
  pointY: point.y,
  padding: 5,
});

<g transform={tooltipPos.transform}>
  <rect {...getTooltipRectAttrs(36, 18)} />
</g>
```

### For DOM Charts:
```tsx
import { calculateDomTooltipPosition } from '@/features/reports/utils/tooltip-positioning';

// In useEffect:
const pos = calculateDomTooltipPosition(element, containerRect, width, height, offsetY);

// In render:
<div style={{ top: pos.top, left: pos.left }}>Tooltip</div>
```

---

## Verification Checklist

- [x] Line chart tooltips stay centered on data points
- [x] Bar chart value labels positioned above bars without overflow
- [x] Pie chart segment labels placed radially without drift
- [x] Horizontal bar chart displays without cutoff
- [x] All tooltips respect container boundaries
- [x] Tooltips reposition intelligently when near edges
- [x] No horizontal jitter on fast hover movements
- [x] Works with responsive container resizing
- [x] z-index properly layered (tooltips on top)
- [x] CSS transitions remain smooth

---

## Files Modified

1. **Created:** `src/features/reports/utils/tooltip-positioning.ts` - Central positioning utility
2. **Updated:** `src/features/reports/components/charts/line-chart.tsx` - Uses SVG positioning utility
3. **Updated:** `src/features/reports/components/charts/bar-chart.tsx` - Uses DOM positioning with useEffect
4. **Updated:** `src/features/reports/components/charts/pie-chart.tsx` - Uses SVG positioning utility
5. **No Changes:** `src/features/reports/components/charts/horizontal-bar-chart.tsx` - Already uses simple approach (no problematic positioning)

---

## Future Enhancements

- Add tooltip animation transitions
- Support custom tooltip content templates
- Add keyboard navigation for tooltips
- Implement touch device support with longer display duration
- Add tooltip theme configuration (dark/light modes)
