export const BREAKPOINTS = {
  tabletPx: 768,
  desktopPx: 896,
} as const;

export const BREAKPOINT_QUERIES = {
  tablet: `(min-width: ${BREAKPOINTS.tabletPx}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktopPx}px)`,
} as const;
