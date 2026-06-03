export type DesignInput = {
  id: string
  name: string
  imagePath: string
  widthCm: number
  heightCm: number
  originalAspectRatio: number
  quantity: number
  canRotate: boolean
}

export type Placement = {
  designId: string
  xCm: number
  yCm: number
  widthCm: number
  heightCm: number
  rotated: boolean
}

export type Sheet = {
  id: string
  widthCm: number
  heightCm: number
  placements: Placement[]
}
