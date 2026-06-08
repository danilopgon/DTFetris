export const EXPORT_DPI = 300

export function cmToPx(cm: number, dpi: number): number {
  return cm * (dpi / 2.54)
}
