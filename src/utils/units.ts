export const EXPORT_DPI = 300

export function cmToPx(cm: number, dpi: number): number {
  return cm * (dpi / 2.54)
}

/** Export rounds positive physical coordinates to the nearest whole pixel. */
export function cmToExportPx(cm: number): number {
  return Math.round(cmToPx(cm, EXPORT_DPI))
}
