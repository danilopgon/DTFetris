export type Cm = number

export type SheetConfig = {
  widthCm: Cm
  heightCm: Cm
}

export const DEFAULT_SHEET_CONFIG: SheetConfig = {
  widthCm: 55,
  heightCm: 100,
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
}

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

export type DomainValidationErrorCode = UnplacedReasonCode | 'invalid_quantity'

export type DomainValidationError = {
  code: DomainValidationErrorCode
  field: string
  designId?: string
}

export function isPositiveIntegerCm(value: number): value is Cm {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0
}

function isEditableQuantity(value: number): boolean {
  return Number.isInteger(value) && value >= 0
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

  return errors
}

export function validatePackingRequest(request: PackingRequest): DomainValidationError[] {
  const errors: DomainValidationError[] = []

  if (!isPositiveIntegerCm(request.sheet.widthCm)) {
    errors.push({ code: 'invalid_dimensions', field: 'sheet.widthCm' })
  }

  if (!isPositiveIntegerCm(request.sheet.heightCm)) {
    errors.push({ code: 'invalid_dimensions', field: 'sheet.heightCm' })
  }

  for (const design of request.designs) {
    errors.push(...validateEditableDesignInput(design))
  }

  if (!request.designs.some((design) => design.quantity > 0)) {
    errors.push({ code: 'invalid_quantity', field: 'designs' })
  }

  return errors
}
