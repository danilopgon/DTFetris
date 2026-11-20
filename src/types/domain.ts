export type Cm = number

export type ImageFormat = 'png' | 'svg'

export type VisibleBounds = {
  xPx: number
  yPx: number
  widthPx: number
  heightPx: number
  sourceWidthPx: number
  sourceHeightPx: number
}

export type ImportDesignRequest = {
  sourcePath: string
  widthCm: Cm
  heightCm: Cm
}

export type ImportDesignErrorCode =
  | 'invalid_format'
  | 'invalid_dimensions'
  | 'file_not_found'
  | 'copy_failed'
  | 'empty_artwork'
  | 'metadata_failed'

export type SheetConfig = {
  widthCm: Cm
  heightCm: Cm
  gapCm?: number
  /** Clear border on every side; missing is the legacy zero margin. */
  marginCm?: number
}

// 58 cm: the film supplier's usable width. Keep in sync with the MCP session default (mcp.rs).
export const DEFAULT_SHEET_CONFIG: SheetConfig = {
  widthCm: 58,
  heightCm: 100,
  gapCm: 0.3,
  // 10 mm so no piece touches the sheet edge. Keep in sync with the MCP session default.
  marginCm: 1,
}

export type DesignInput = {
  id: string
  name: string
  imagePath: string
  widthCm: Cm
  heightCm: Cm
  originalAspectRatio: number
  quantity: number
  canRotate: boolean
  format: ImageFormat
  visibleBounds: VisibleBounds
  colorOverride?: string | null
}

export type DesignUpdatePatch = Partial<
  Pick<DesignInput, 'name' | 'widthCm' | 'heightCm' | 'quantity' | 'canRotate' | 'colorOverride'>
>

export type Placement = {
  designId: string
  xCm: Cm
  yCm: Cm
  widthCm: Cm
  heightCm: Cm
  rotated: boolean
}

export type Sheet = {
  id: string
  widthCm: Cm
  heightCm: Cm
  gapCm?: number
  marginCm?: number
  placements: Placement[]
}

export type PackingRequest = {
  sheet: SheetConfig
  designs: DesignInput[]
}

export type UnplacedReasonCode =
  | 'does_not_fit'
  | 'invalid_dimensions'
  | 'invalid_quantity'
  | 'sheet_too_small'

export type UnplacedItem = {
  designId: string
  itemIndex: number
  reason: UnplacedReasonCode
}

export type PackingResult = {
  sheets: Sheet[]
  unplacedItems: UnplacedItem[]
}

export type DomainValidationErrorCode =
  | UnplacedReasonCode
  | 'invalid_quantity'
  | 'invalid_name'
  | 'invalid_color_override'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function isValidColorOverride(value: unknown): value is string | null | undefined {
  return value == null || (typeof value === 'string' && value.length === 7 && HEX_COLOR.test(value))
}

export type DomainValidationError = {
  code: DomainValidationErrorCode
  field: string
  designId?: string
}

export function isPositiveIntegerCm(value: number): value is Cm {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0 && value <= 4_294_967_295
}

export function isValidGapCm(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 4_294_967_295
}

/** Same contract as validate_margin_cm in Rust: twice the margin leaves a positive inner area. */
export function isValidMarginCm(
  value: number | undefined,
  widthCm: number,
  heightCm: number,
): boolean {
  const margin = value ?? 0
  return Number.isFinite(margin) && margin >= 0 && margin * 2 < widthCm && margin * 2 < heightCm
}

function isEditableQuantity(value: number): boolean {
  return Number.isInteger(value) && value >= 1
}

export type Job = {
  version: 1
  sheetConfig: SheetConfig
  designs: DesignInput[]
}

export function validateEditableDesignInput(design: DesignInput): DomainValidationError[] {
  const errors: DomainValidationError[] = []

  if (!isPositiveIntegerCm(design.widthCm)) {
    errors.push({ code: 'invalid_dimensions', field: 'widthCm', designId: design.id })
  }

  if (!isPositiveIntegerCm(design.heightCm)) {
    errors.push({ code: 'invalid_dimensions', field: 'heightCm', designId: design.id })
  }

  if (!isEditableQuantity(design.quantity)) {
    errors.push({ code: 'invalid_quantity', field: 'quantity', designId: design.id })
  }

  if (design.name.trim().length === 0) {
    errors.push({ code: 'invalid_name', field: 'name', designId: design.id })
  }

  if (!isValidColorOverride(design.colorOverride)) {
    errors.push({ code: 'invalid_color_override', field: 'colorOverride', designId: design.id })
  }

  return errors
}

export function getFittedVisibleSizeCm(
  maximumSize: Pick<DesignInput, 'widthCm' | 'heightCm'>,
  artworkAspectRatio: number,
): Pick<DesignInput, 'widthCm' | 'heightCm'> {
  const maximumRatio = maximumSize.widthCm / maximumSize.heightCm

  if (artworkAspectRatio > maximumRatio) {
    return {
      widthCm: maximumSize.widthCm,
      heightCm: maximumSize.widthCm / artworkAspectRatio,
    }
  }

  return {
    widthCm: maximumSize.heightCm * artworkAspectRatio,
    heightCm: maximumSize.heightCm,
  }
}

export function getVisiblePackingFootprintCm(
  design: Pick<DesignInput, 'widthCm' | 'heightCm' | 'originalAspectRatio'>,
): Pick<DesignInput, 'widthCm' | 'heightCm'> {
  return getFittedVisibleSizeCm(design, design.originalAspectRatio)
}

export function validatePackingRequest(request: PackingRequest): DomainValidationError[] {
  const errors: DomainValidationError[] = []

  if (!isPositiveIntegerCm(request.sheet.widthCm)) {
    errors.push({ code: 'invalid_dimensions', field: 'sheet.widthCm' })
  }

  if (!isPositiveIntegerCm(request.sheet.heightCm)) {
    errors.push({ code: 'invalid_dimensions', field: 'sheet.heightCm' })
  }

  if (!isValidGapCm(request.sheet.gapCm ?? 0)) {
    errors.push({ code: 'invalid_dimensions', field: 'sheet.gapCm' })
  }

  if (!isValidMarginCm(request.sheet.marginCm, request.sheet.widthCm, request.sheet.heightCm)) {
    errors.push({ code: 'invalid_dimensions', field: 'sheet.marginCm' })
  }

  for (const design of request.designs) {
    errors.push(...validateEditableDesignInput(design))
  }

  if (!request.designs.some((design) => design.quantity > 0)) {
    errors.push({ code: 'invalid_quantity', field: 'designs' })
  }

  return errors
}
