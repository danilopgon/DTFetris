export function cmToPx(cm: number, dpi: number): number {
  return cm * (dpi / 2.54)
}
