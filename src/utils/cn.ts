/**
 * Utility to conditionally combine classNames.
 * Similar to `clsx` or `classnames` package.
 * Used throughout HC Quality for Tailwind class composition.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
