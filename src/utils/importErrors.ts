import type { ImportDesignErrorCode } from '../types/domain'

const ERROR_MESSAGES: Record<ImportDesignErrorCode | 'default', string> = {
  invalid_format: 'Formato no soportado. Solo se aceptan archivos PNG y SVG.',
  empty_artwork: 'El diseño está vacío o es completamente transparente.',
  file_not_found: 'No se encontró el archivo seleccionado.',
  copy_failed: 'Error al guardar el diseño. Comprueba el espacio en disco.',
  invalid_dimensions: 'Las dimensiones deben ser valores positivos.',
  metadata_failed: 'Error al procesar el archivo de imagen.',
  default: 'Error desconocido al importar el diseño.',
}

export function mapImportErrorToMessage(code: string): string {
  return ERROR_MESSAGES[code as ImportDesignErrorCode] ?? ERROR_MESSAGES.default
}
