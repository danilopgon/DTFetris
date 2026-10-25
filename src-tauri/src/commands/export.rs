use crate::domain::assets::{inspect_asset, parse_svg, read_asset, validate_svg_tree_at_scale};
use crate::domain::design::{
    fitted_visible_size_cm, parse_color_override, DesignInput, ImageFormat, Placement, Sheet,
};
use crate::domain::packing::{validate_gap_cm, CM_QUANTUM};
use image::{imageops, RgbaImage};
use std::{
    collections::{HashMap, HashSet},
    fs::{self, OpenOptions},
    io::{BufWriter, Write},
    path::{Path, PathBuf},
};

// Allows 60 × 100 cm at 300 DPI. Bound every raster before allocating it.
const MAX_PIXELS: u64 = 100_000_000;
const MAX_SIDE: u32 = 32_768;
const EPSILON: f64 = 1e-7;

#[tauri::command]
pub async fn export_png(
    sheets: Vec<Sheet>,
    designs: Vec<DesignInput>,
    output_path: String,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        export_png_into(&sheets, &designs, Path::new(&output_path))
    })
    .await
    .map_err(|_| "No se pudo completar la exportación PNG.".to_string())?
}

fn positive_integer(value: f64) -> bool {
    value.is_finite() && value > 0.0 && value.fract() == 0.0
}

fn raster_size(width: u32, height: u32) -> Result<(u32, u32), String> {
    if width == 0
        || height == 0
        || width > MAX_SIDE
        || height > MAX_SIDE
        || u64::from(width) * u64::from(height) > MAX_PIXELS
    {
        return Err(
            "La imagen supera el límite de exportación (100 millones de píxeles y 32768 por lado)."
                .into(),
        );
    }
    Ok((width, height))
}

fn cm_px(cm: f64) -> u32 {
    (cm * 300.0 / 2.54).round() as u32
}

fn validate(sheets: &[Sheet], designs: &[DesignInput]) -> Result<(), String> {
    if sheets.is_empty() || designs.is_empty() {
        return Err("No hay planchas o diseños para exportar.".into());
    }
    let mut by_id = HashMap::new();
    for d in designs {
        parse_color_override(d.color_override.as_deref())?;
        let b = &d.visible_bounds;
        if d.id.trim().is_empty()
            || by_id.insert(&d.id, d).is_some()
            || d.name.trim().is_empty()
            || d.image_path.trim().is_empty()
            || !positive_integer(d.width_cm)
            || !positive_integer(d.height_cm)
            || d.quantity == 0
            || ![
                b.width_px,
                b.height_px,
                b.source_width_px,
                b.source_height_px,
            ]
            .into_iter()
            .all(positive_integer)
            || ![b.x_px, b.y_px]
                .into_iter()
                .all(|v| v.is_finite() && v >= 0.0 && v.fract() == 0.0)
            || b.x_px + b.width_px > b.source_width_px
            || b.y_px + b.height_px > b.source_height_px
            || !d.original_aspect_ratio.is_finite()
            || d.original_aspect_ratio <= 0.0
            || (d.original_aspect_ratio - b.width_px / b.height_px).abs()
                > EPSILON * d.original_aspect_ratio.max(1.0)
        {
            return Err("Los metadatos de un diseño no son válidos.".into());
        }
        raster_size(b.source_width_px as u32, b.source_height_px as u32)?;
    }
    let mut ids = HashSet::new();
    let mut counts = HashMap::<&str, u32>::new();
    if designs.iter().map(|d| u64::from(d.quantity)).sum::<u64>() > 1000 || sheets.len() > 1000 {
        return Err("El trabajo supera el límite de 1000 copias.".into());
    }
    for sheet in sheets {
        let gap = validate_gap_cm(sheet.gap_cm)?;
        if sheet.id.trim().is_empty()
            || !ids.insert(&sheet.id)
            || !positive_integer(sheet.width_cm)
            || !positive_integer(sheet.height_cm)
            || sheet.placements.is_empty()
        {
            return Err("Las dimensiones o identificadores de las planchas no son válidos.".into());
        }
        raster_size(cm_px(sheet.width_cm), cm_px(sheet.height_cm))?;
        for (index, p) in sheet.placements.iter().enumerate() {
            let d = by_id
                .get(&p.design_id)
                .ok_or("Una ubicación referencia un diseño inexistente.")?;
            let (fit_w, fit_h) = fitted_visible_size_cm(d)?;
            let (w, h) = if p.rotated {
                (fit_h, fit_w)
            } else {
                (fit_w, fit_h)
            };
            if ![p.x_cm, p.y_cm]
                .into_iter()
                .all(|v| v.is_finite() && v >= 0.0)
                || !p.width_cm.is_finite()
                || !p.height_cm.is_finite()
                || p.width_cm < w - EPSILON
                || p.width_cm > w + CM_QUANTUM + EPSILON
                || p.height_cm < h - EPSILON
                || p.height_cm > h + CM_QUANTUM + EPSILON
                || (p.rotated && !d.can_rotate)
                || p.x_cm + p.width_cm > sheet.width_cm + EPSILON
                || p.y_cm + p.height_cm > sheet.height_cm + EPSILON
            {
                return Err(
                    "Una ubicación tiene dimensiones, rotación o límites inválidos.".into(),
                );
            }
            for other in &sheet.placements[..index] {
                if p.x_cm < other.x_cm + other.width_cm + gap - EPSILON
                    && other.x_cm < p.x_cm + p.width_cm + gap - EPSILON
                    && p.y_cm < other.y_cm + other.height_cm + gap - EPSILON
                    && other.y_cm < p.y_cm + p.height_cm + gap - EPSILON
                {
                    return Err(
                        "Las ubicaciones se solapan o no respetan la separación mínima.".into(),
                    );
                }
            }
            let count = counts.entry(&p.design_id).or_default();
            *count = count
                .checked_add(1)
                .ok_or("La cantidad de ubicaciones es excesiva.")?;
            if *count > d.quantity {
                return Err("Las ubicaciones exceden la cantidad solicitada.".into());
            }
        }
    }
    if designs
        .iter()
        .any(|d| counts.get(d.id.as_str()).copied().unwrap_or(0) != d.quantity)
    {
        return Err("La composición no contiene todas las copias solicitadas. Vuelve a generar las planchas.".into());
    }
    Ok(())
}

fn artwork(d: &DesignInput, width: u32, height: u32) -> Result<RgbaImage, String> {
    let color = parse_color_override(d.color_override.as_deref())?;
    raster_size(width, height)?;
    let path = Path::new(&d.image_path);
    let data = read_asset(path)?;
    let b = &d.visible_bounds;
    let mut result = match d.format {
        ImageFormat::Png => {
            let (source_width, source_height) =
                image::image_dimensions(path).map_err(|_| "El archivo PNG no es válido.")?;
            raster_size(source_width, source_height)?;
            if source_width != b.source_width_px as u32
                || source_height != b.source_height_px as u32
            {
                return Err("El PNG no coincide con sus dimensiones persistidas.".into());
            }
            let mut reader = image::ImageReader::with_format(
                std::io::Cursor::new(data),
                image::ImageFormat::Png,
            );
            let mut limits = image::Limits::default();
            limits.max_image_width = Some(MAX_SIDE);
            limits.max_image_height = Some(MAX_SIDE);
            limits.max_alloc = Some(MAX_PIXELS * 4);
            reader.limits(limits);
            let decoded = reader
                .decode()
                .map_err(|_| "El archivo PNG es inválido o demasiado grande.")?;
            if decoded.width() != b.source_width_px as u32
                || decoded.height() != b.source_height_px as u32
            {
                return Err("El PNG no coincide con sus dimensiones persistidas.".into());
            }
            raster_size(decoded.width(), decoded.height())?;
            let mut crop = decoded
                .crop_imm(
                    b.x_px as u32,
                    b.y_px as u32,
                    b.width_px as u32,
                    b.height_px as u32,
                )
                .into_rgba8();
            if !crop.pixels().any(|p| p[3] >= 3) {
                return Err("El diseño no contiene arte visible.".into());
            }
            // Resize in premultiplied alpha space so invisible RGB cannot bleed
            // into antialiased edges or transparent holes in the printed artwork.
            for pixel in crop.pixels_mut() {
                let alpha = u32::from(pixel[3]);
                for channel in &mut pixel.0[..3] {
                    *channel = ((u32::from(*channel) * alpha + 127) / 255) as u8;
                }
            }
            let mut resized =
                imageops::resize(&crop, width, height, imageops::FilterType::Lanczos3);
            for pixel in resized.pixels_mut() {
                let alpha = u32::from(pixel[3]);
                if alpha > 0 {
                    for channel in &mut pixel.0[..3] {
                        *channel = ((u32::from(*channel) * 255 + alpha / 2) / alpha).min(255) as u8;
                    }
                }
            }
            resized
        }
        ImageFormat::Svg => {
            let tree = parse_svg(&data)?;
            if tree.size().width().ceil() as u32 != b.source_width_px as u32
                || tree.size().height().ceil() as u32 != b.source_height_px as u32
            {
                return Err("El SVG no coincide con sus dimensiones persistidas.".into());
            }
            // Persisted bounds are normalized source coordinates. Render only that
            // window directly at export resolution, never an import-sized bitmap.
            let sx = width as f32
                / (b.width_px / b.source_width_px * f64::from(tree.size().width())) as f32;
            let sy = height as f32
                / (b.height_px / b.source_height_px * f64::from(tree.size().height())) as f32;
            let tx = -(b.x_px / b.width_px * f64::from(width)) as f32;
            let ty = -(b.y_px / b.height_px * f64::from(height)) as f32;
            validate_svg_tree_at_scale(&tree, sx, sy)?;
            let mut pixmap = resvg::tiny_skia::Pixmap::new(width, height)
                .ok_or("No hay memoria para rasterizar el SVG.")?;
            resvg::render(
                &tree,
                resvg::tiny_skia::Transform::from_row(sx, 0.0, 0.0, sy, tx, ty),
                &mut pixmap.as_mut(),
            );
            let mut data = pixmap.take();
            // tiny-skia is premultiplied; image::overlay expects straight RGBA.
            for pixel in data.chunks_exact_mut(4) {
                let alpha = u32::from(pixel[3]);
                if alpha != 0 {
                    for channel in &mut pixel[..3] {
                        *channel = ((u32::from(*channel) * 255 + alpha / 2) / alpha).min(255) as u8;
                    }
                }
            }
            RgbaImage::from_raw(width, height, data).ok_or("No se pudo rasterizar el SVG.")?
        }
    };
    if !result.pixels().any(|p| p[3] >= 3) {
        return Err("El diseño no contiene arte visible.".into());
    }
    apply_color_override(&mut result, color);
    Ok(result)
}

/// Recolor straight RGBA only after resampling, preserving every alpha byte.
fn apply_color_override(image: &mut RgbaImage, color: Option<[u8; 3]>) {
    if let Some(rgb) = color {
        for pixel in image.pixels_mut() {
            pixel.0[..3].copy_from_slice(&rgb);
        }
    }
}

fn composite(canvas: &mut RgbaImage, d: &DesignInput, p: &Placement) -> Result<(), String> {
    let (w_cm, h_cm) = fitted_visible_size_cm(d)?;
    let image = artwork(d, cm_px(w_cm).max(1), cm_px(h_cm).max(1))?;
    let (image, w_cm, h_cm) = if p.rotated {
        (imageops::rotate90(&image), h_cm, w_cm)
    } else {
        (image, w_cm, h_cm)
    };
    let x = cm_px(p.x_cm + (p.width_cm - w_cm) / 2.0);
    let y = cm_px(p.y_cm + (p.height_cm - h_cm) / 2.0);
    imageops::overlay(canvas, &image, i64::from(x), i64::from(y));
    Ok(())
}

fn output_paths(path: &Path, count: usize) -> Result<Vec<PathBuf>, String> {
    if path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("png"))
        != Some(true)
    {
        return Err("El destino debe ser un archivo con extensión .png.".into());
    }
    let stem = path.file_stem().ok_or("La ruta de destino no es válida.")?;
    if count == 1 {
        return Ok(vec![path.to_path_buf()]);
    }
    Ok((1..=count)
        .map(|index| {
            let mut name = stem.to_os_string();
            name.push(format!("-{index:03}.png"));
            path.with_file_name(name)
        })
        .collect())
}

/// Synchronous core: one sheet and one artwork at a time; never caches pages.
pub fn export_png_into(
    sheets: &[Sheet],
    designs: &[DesignInput],
    path: &Path,
) -> Result<Vec<String>, String> {
    validate(sheets, designs)?;
    let mut inspected = HashMap::new();
    for design in designs {
        let bounds = if let Some(bounds) = inspected.get(&design.image_path) {
            bounds
        } else {
            let bounds = inspect_asset(Path::new(&design.image_path), &design.format)?;
            inspected.entry(design.image_path.clone()).or_insert(bounds)
        };
        if *bounds != design.visible_bounds {
            return Err("El archivo de diseño cambió desde la importación. Vuelve a importarlo antes de exportar.".into());
        }
    }
    let paths = output_paths(path, sheets.len())?;
    if paths.iter().any(|p| p.exists()) {
        return Err("Ya existe un archivo de destino. Elige otro nombre.".into());
    }
    let by_id: HashMap<_, _> = designs.iter().map(|d| (d.id.as_str(), d)).collect();
    let mut created = Vec::new();
    let result = (|| {
        for (sheet, path) in sheets.iter().zip(&paths) {
            let (width, height) = raster_size(cm_px(sheet.width_cm), cm_px(sheet.height_cm))?;
            let byte_count = width as usize * height as usize * 4;
            let mut pixels = Vec::new();
            pixels.try_reserve_exact(byte_count).map_err(|_| "No hay memoria suficiente para la plancha. Cierra otras aplicaciones o reduce su tamaño.")?;
            pixels.resize(byte_count, 0);
            let mut canvas =
                RgbaImage::from_raw(width, height, pixels).ok_or("No se pudo crear la plancha.")?;
            for placement in &sheet.placements {
                composite(&mut canvas, by_id[placement.design_id.as_str()], placement)?;
            }
            let file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)
                .map_err(|_| {
                    "No se pudo crear el PNG; verifica permisos y que el destino no exista."
                })?;
            created.push(path.clone());
            let mut buffer = BufWriter::new(file);
            {
                let mut encoder = png::Encoder::new(&mut buffer, width, height);
                encoder.set_color(png::ColorType::Rgba);
                encoder.set_depth(png::BitDepth::Eight);
                encoder.set_pixel_dims(Some(png::PixelDimensions {
                    xppu: 11811,
                    yppu: 11811,
                    unit: png::Unit::Meter,
                }));
                let mut writer = encoder
                    .write_header()
                    .map_err(|_| "No se pudo escribir la cabecera PNG.")?;
                writer
                    .write_image_data(canvas.as_raw())
                    .map_err(|_| "No se pudo escribir el PNG.")?;
                writer
                    .finish()
                    .map_err(|_| "No se pudo finalizar el PNG.")?;
            }
            buffer.flush().map_err(|_| "No se pudo guardar el PNG.")?;
            buffer
                .get_ref()
                .sync_all()
                .map_err(|_| "No se pudo guardar el PNG en disco.")?;
        }
        Ok(paths
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect())
    })();
    if result.is_err() {
        // Only exclusive-created outputs belonging to this invocation, never inputs.
        for path in created {
            let _ = fs::remove_file(path);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::import::import_design_into;
    use image::Rgba;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("dtf-export-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn png(&self) -> DesignInput {
            let path = self.0.join("source.png");
            let mut source = RgbaImage::new(12, 12);
            for y in 4..8 {
                for x in 2..10 {
                    source.put_pixel(
                        x,
                        y,
                        if x < 6 {
                            Rgba([255, 0, 0, 128])
                        } else {
                            Rgba([0, 0, 255, 255])
                        },
                    );
                }
            }
            source.save(&path).unwrap();
            import_design_into(&self.0, path.to_str().unwrap(), 2.0, 2.0).unwrap()
        }
        fn svg(&self) -> DesignInput {
            let path = self.0.join("source.svg");
            fs::write(&path, r#"<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect x="2" y="4" width="8" height="4" fill="red" fill-opacity="0.5"/></svg>"#).unwrap();
            import_design_into(&self.0, path.to_str().unwrap(), 2.0, 2.0).unwrap()
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn sheet(d: &DesignInput) -> Sheet {
        let (width_cm, height_cm) = fitted_visible_size_cm(d).unwrap();
        Sheet {
            gap_cm: None,
            id: "sheet-1".into(),
            width_cm: 4.0,
            height_cm: 4.0,
            placements: vec![Placement {
                design_id: d.id.clone(),
                x_cm: 1.0,
                y_cm: 1.0,
                width_cm,
                height_cm,
                rotated: false,
            }],
        }
    }

    fn export(f: &Fixture, s: &[Sheet], d: &[DesignInput]) -> Result<Vec<String>, String> {
        export_png_into(s, d, &f.0.join("output.png"))
    }

    #[test]
    fn recolor_preserves_every_alpha_value_and_none_preserves_every_channel() {
        let original = RgbaImage::from_fn(256, 1, |x, _| Rgba([19, 87, 203, x as u8]));
        let mut recolored = original.clone();
        apply_color_override(&mut recolored, Some([171, 9, 255]));
        for (x, pixel) in recolored.pixels().enumerate() {
            assert_eq!(pixel.0, [171, 9, 255, x as u8]);
        }
        let mut unchanged = original.clone();
        apply_color_override(&mut unchanged, None);
        assert_eq!(unchanged, original);
    }

    #[test]
    fn fractional_svg_fit_exports_without_requested_box_padding_and_validates_gap() {
        let f = Fixture::new();
        let source = f.0.join("narrow.svg");
        fs::write(&source, r#"<svg xmlns="http://www.w3.org/2000/svg" width="570" height="91"><rect width="570" height="91" fill="red" fill-opacity="0.5"/></svg>"#).unwrap();
        let mut d = import_design_into(&f.0, source.to_str().unwrap(), 9.0, 8.0).unwrap();
        d.quantity = 2;
        d.color_override = Some("#123456".into());
        let packed = crate::domain::packing::pack(&crate::domain::packing::PackingRequest {
            sheet: crate::domain::packing::SheetConfig {
                width_cm: 9.0,
                height_cm: 4.0,
                gap_cm: Some(0.3),
            },
            designs: vec![d.clone()],
        })
        .unwrap();
        assert_eq!(packed.sheets.len(), 1);
        let p = &packed.sheets[0].placements[0];
        assert_eq!((p.width_cm, p.height_cm), (9.0, 1.4369));
        let paths = export(&f, &packed.sheets, &[d.clone()]).unwrap();
        let output = image::open(&paths[0]).unwrap().into_rgba8();
        assert_eq!(output.dimensions(), (cm_px(9.0), cm_px(4.0)));
        assert_eq!(*output.get_pixel(20, 20), Rgba([18, 52, 86, 128]));
        assert_eq!(output.get_pixel(20, cm_px(1.55))[3], 0);
        assert_eq!(output.get_pixel(20, cm_px(2.0))[3], 128);
        let mut invalid = packed.sheets.clone();
        invalid[0].placements[1].y_cm = p.height_cm + 0.2;
        assert!(validate(&invalid, &[d.clone()]).is_err());
        invalid = packed.sheets.clone();
        invalid[0].placements[0].height_cm = 8.0;
        assert!(validate(&invalid, &[d.clone()]).is_err());
        invalid = packed.sheets.clone();
        invalid[0].placements[0].height_cm -= CM_QUANTUM;
        assert!(validate(&invalid, &[d]).is_err());
    }

    #[test]
    fn fractional_intrinsic_svg_exports_using_normalized_bounds_at_fractional_cm_size() {
        let f = Fixture::new();
        let source = f.0.join("fractional.svg");
        fs::write(&source, r#"<svg xmlns="http://www.w3.org/2000/svg" width="12.5" height="7.5"><rect width="12.5" height="7.5" fill="blue"/></svg>"#).unwrap();
        let d = import_design_into(&f.0, source.to_str().unwrap(), 3.0, 3.0).unwrap();
        let packed = crate::domain::packing::pack(&crate::domain::packing::PackingRequest {
            sheet: crate::domain::packing::SheetConfig {
                width_cm: 3.0,
                height_cm: 2.0,
                gap_cm: Some(0.3),
            },
            designs: vec![d.clone()],
        })
        .unwrap();
        assert!(packed.unplaced_items.is_empty());
        let p = &packed.sheets[0].placements[0];
        assert_eq!((p.width_cm, p.height_cm), (3.0, 1.8462));
        let paths = export(&f, &packed.sheets, &[d]).unwrap();
        let output = image::open(&paths[0]).unwrap().into_rgba8();
        assert_eq!(*output.get_pixel(20, 20), Rgba([0, 0, 255, 255]));
        assert_eq!(output.get_pixel(20, cm_px(1.95))[3], 0);
    }

    #[test]
    fn png_and_svg_override_export_preserves_alpha_geometry_source_and_can_clear() {
        for format in [ImageFormat::Png, ImageFormat::Svg] {
            let f = Fixture::new();
            let mut d = match format {
                ImageFormat::Png => f.png(),
                ImageFormat::Svg => f.svg(),
            };
            let original_design = serde_json::to_value(&d).unwrap();
            let source = fs::read(&d.image_path).unwrap();
            let s = sheet(&d);
            let baseline_path = f.0.join("baseline.png");
            export_png_into(&[s.clone()], &[d.clone()], &baseline_path).unwrap();
            let baseline = image::open(&baseline_path).unwrap().into_rgba8();
            let original_art = artwork(&d, 237, 119).unwrap();
            d.color_override = Some("#aB09fF".into());
            let art = artwork(&d, 237, 119).unwrap();
            for (before, after) in original_art.pixels().zip(art.pixels()) {
                assert_eq!(before[3], after[3]);
                assert_eq!(&after.0[..3], &[171, 9, 255]);
            }
            let output_paths = export(&f, &[s.clone()], &[d.clone()]).unwrap();
            let output = image::open(&output_paths[0]).unwrap().into_rgba8();
            assert_eq!(output.dimensions(), baseline.dimensions());
            for (before, after) in baseline.pixels().zip(output.pixels()) {
                assert_eq!(before[3], after[3]);
                if after[3] > 0 {
                    // Composition uses floating-point alpha math; allow only its
                    // unavoidable one-byte rounding, never interpolation colors.
                    for (actual, expected) in after.0[..3].iter().zip([171u8, 9, 255]) {
                        assert!(actual.abs_diff(expected) <= 1);
                    }
                }
            }
            assert_eq!(*output.get_pixel(150, 220), Rgba([171, 9, 255, 128]));
            assert_eq!(fs::read(&d.image_path).unwrap(), source);
            d.color_override = None;
            assert_eq!(serde_json::to_value(&d).unwrap(), original_design);
            assert_eq!(artwork(&d, 237, 119).unwrap(), original_art);
            let cleared_path = f.0.join("cleared.png");
            export_png_into(&[s], &[d], &cleared_path).unwrap();
            assert_eq!(image::open(cleared_path).unwrap().into_rgba8(), baseline);
        }
    }

    #[test]
    fn invalid_override_is_rejected_before_export_and_artwork() {
        let f = Fixture::new();
        let mut d = f.png();
        for invalid in ["", "#123", "#12345678", "#zz0000", " #123456"] {
            d.color_override = Some(invalid.into());
            assert!(export(&f, &[sheet(&d)], &[d.clone()])
                .unwrap_err()
                .contains("#RRGGBB"));
            assert!(artwork(&d, 10, 10).is_err());
        }
        assert!(!f.0.join("output.png").exists());
    }

    #[test]
    fn png_dimensions_density_padding_fit_position_and_transparency() {
        let f = Fixture::new();
        let d = f.png();
        let paths = export(&f, &[sheet(&d)], &[d]).unwrap();
        let output = image::open(&paths[0]).unwrap().into_rgba8();
        assert_eq!(output.dimensions(), (472, 472));
        assert_eq!(output.get_pixel(0, 0)[3], 0);
        assert_eq!(*output.get_pixel(150, 150), Rgba([255, 0, 0, 128]));
        assert_eq!(*output.get_pixel(320, 150), Rgba([0, 0, 255, 255]));
        assert_eq!(output.get_pixel(150, 250)[3], 0); // no unused requested-cell padding
        assert_eq!(output.get_pixel(370, 150)[3], 0);
        let decoder =
            png::Decoder::new(std::io::BufReader::new(fs::File::open(&paths[0]).unwrap()));
        let reader = decoder.read_info().unwrap();
        let density = reader.info().pixel_dims.unwrap();
        assert_eq!(
            (density.xppu, density.yppu, density.unit),
            (11811, 11811, png::Unit::Meter)
        );
    }

    #[test]
    fn rotation_is_clockwise_and_keeps_aspect_ratio() {
        let f = Fixture::new();
        let d = f.png();
        let mut s = sheet(&d);
        s.placements[0].rotated = true;
        s.placements[0].width_cm = 1.0;
        s.placements[0].height_cm = 2.0;
        let paths = export(&f, &[s], &[d]).unwrap();
        let output = image::open(&paths[0]).unwrap().into_rgba8();
        assert_eq!(*output.get_pixel(150, 150), Rgba([255, 0, 0, 128]));
        assert_eq!(*output.get_pixel(150, 320), Rgba([0, 0, 255, 255]));
        assert_eq!(output.get_pixel(250, 220)[3], 0);
    }

    #[test]
    fn rotated_nonsquare_cell_uses_swapped_dimensions_and_centered_fit() {
        let f = Fixture::new();
        let mut d = f.png();
        d.width_cm = 3.0;
        d.height_cm = 1.0;
        let mut s = sheet(&d);
        s.placements[0].width_cm = 1.0;
        s.placements[0].height_cm = 2.0;
        s.placements[0].rotated = true;
        let paths = export(&f, &[s], &[d]).unwrap();
        let output = image::open(&paths[0]).unwrap().into_rgba8();
        assert_eq!(*output.get_pixel(160, 140), Rgba([255, 0, 0, 128]));
        assert_eq!(*output.get_pixel(160, 320), Rgba([0, 0, 255, 255]));
        assert_eq!(output.get_pixel(160, 440)[3], 0);
    }

    #[test]
    fn svg_renders_at_target_resolution_without_premultiplied_darkening() {
        let f = Fixture::new();
        let d = f.svg();
        let paths = export(&f, &[sheet(&d)], &[d]).unwrap();
        let output = image::open(&paths[0]).unwrap().into_rgba8();
        let p = output.get_pixel(150, 220);
        assert_eq!(p[0], 255);
        assert!((127..=128).contains(&p[3]));
        assert!((127..=128).contains(&output.get_pixel(150, 150)[3]));
        // Direct vector rasterization has no import-resolution interpolation blur.
        assert_eq!(output.get_pixel(cm_px(1.0), 220)[0], 255);
    }

    #[test]
    fn mixed_multipage_returns_paths_and_never_overwrites() {
        let f = Fixture::new();
        let png = f.png();
        let svg = f.svg();
        let s1 = sheet(&png);
        let mut s2 = sheet(&svg);
        s2.id = "sheet-2".into();
        let sheets = vec![s1, s2];
        let designs = vec![png, svg];
        let paths = export(&f, &sheets, &designs).unwrap();
        assert!(paths[0].ends_with("output-001.png"));
        assert!(paths[1].ends_with("output-002.png"));
        let previous = fs::read(&paths[0]).unwrap();
        assert!(export(&f, &sheets, &designs).is_err());
        assert_eq!(fs::read(&paths[0]).unwrap(), previous);
    }

    #[test]
    fn rollback_removes_only_outputs_created_by_this_operation() {
        let f = Fixture::new();
        let d1 = f.png();
        let mut d2 = d1.clone();
        d2.id = "missing".into();
        d2.image_path = f.0.join("missing.png").to_string_lossy().into_owned();
        let s1 = sheet(&d1);
        let mut s2 = sheet(&d2);
        s2.id = "sheet-2".into();
        let existing = f.0.join("unrelated.png");
        fs::write(&existing, b"keep me").unwrap();
        assert!(export(&f, &[s1, s2], &[d1.clone(), d2]).is_err());
        assert!(!f.0.join("output-001.png").exists());
        assert!(!f.0.join("output-002.png").exists());
        assert_eq!(fs::read(existing).unwrap(), b"keep me");
        assert!(Path::new(&d1.image_path).exists());
    }

    #[test]
    fn rejects_invalid_layouts_and_metadata_before_writing() {
        let f = Fixture::new();
        let d = f.png();
        let valid = sheet(&d);
        let mut cases = Vec::new();
        let mut s = valid.clone();
        s.placements[0].x_cm = f64::NAN;
        cases.push(s);
        let mut s = valid.clone();
        s.placements[0].x_cm = -1.0;
        cases.push(s);
        let mut s = valid.clone();
        s.placements[0].x_cm = 3.0;
        cases.push(s);
        let mut s = valid.clone();
        s.placements[0].width_cm = 1.0;
        cases.push(s);
        let mut s = valid.clone();
        s.placements[0].design_id = "unknown".into();
        cases.push(s);
        let mut s = valid.clone();
        s.placements.push(s.placements[0].clone());
        cases.push(s);
        let mut s = valid.clone();
        s.width_cm = 1000000.0;
        cases.push(s);
        let mut s = valid.clone();
        s.height_cm = 0.5;
        cases.push(s);
        for s in cases {
            assert!(export(&f, &[s], &[d.clone()]).is_err());
        }
        let mut bad_designs = Vec::new();
        let mut bad = d.clone();
        bad.visible_bounds.x_px = 100.0;
        bad_designs.push(bad);
        let mut bad = d.clone();
        bad.visible_bounds.width_px = 0.0;
        bad_designs.push(bad);
        let mut bad = d.clone();
        bad.original_aspect_ratio = 1.0;
        bad_designs.push(bad);
        let mut bad = d.clone();
        bad.quantity = 0;
        bad_designs.push(bad);
        for bad in bad_designs {
            assert!(export(&f, &[valid.clone()], &[bad]).is_err());
        }
        assert!(export(&f, &[valid.clone()], &[d.clone(), d.clone()]).is_err());
        assert!(export(&f, &[], &[d.clone()]).is_err());
        let mut bad = d.clone();
        bad.can_rotate = false;
        let mut s = valid.clone();
        s.placements[0].rotated = true;
        assert!(export(&f, &[s], &[bad]).is_err());
        let mut s = valid.clone();
        s.id = "sheet-2".into();
        assert!(export(&f, &[valid, s], &[d]).is_err()); // quantity exceeded across pages
        assert!(!f.0.join("output.png").exists());
    }

    #[test]
    fn rejects_missing_corrupt_changed_and_empty_assets() {
        let f = Fixture::new();
        let d = f.png();
        fs::write(&d.image_path, b"not a PNG").unwrap();
        assert!(export(&f, &[sheet(&d)], &[d.clone()]).is_err());
        RgbaImage::new(1, 1).save(&d.image_path).unwrap();
        assert!(export(&f, &[sheet(&d)], &[d.clone()]).is_err());
        RgbaImage::new(12, 12).save(&d.image_path).unwrap();
        assert!(export(&f, &[sheet(&d)], &[d.clone()]).is_err());
        fs::remove_file(&d.image_path).unwrap();
        assert!(export(&f, &[sheet(&d)], &[d]).is_err());
        let svg = f.svg();
        fs::write(&svg.image_path, "invalid").unwrap();
        assert!(export(&f, &[sheet(&svg)], &[svg]).is_err());
    }

    #[test]
    fn allocation_guard_allows_sixty_by_one_hundred_but_rejects_excess() {
        assert_eq!((cm_px(60.0), cm_px(100.0)), (7087, 11811));
        assert_eq!(7087_u64 * 11811 * 4, 334_818_228);
        assert!(raster_size(7087, 11811).is_ok());
        assert!(raster_size(10001, 10000).is_err());
        assert!(raster_size(32769, 1).is_err());
    }

    #[test]
    fn resampling_does_not_print_rgb_from_transparent_pixels() {
        let f = Fixture::new();
        let path = f.0.join("hole.png");
        let mut source = RgbaImage::from_pixel(8, 4, Rgba([0, 0, 255, 0]));
        for y in 0..4 {
            for x in [0, 1, 6, 7] {
                source.put_pixel(x, y, Rgba([255, 0, 0, 255]));
            }
        }
        source.save(&path).unwrap();
        let d = import_design_into(&f.0, path.to_str().unwrap(), 2.0, 2.0).unwrap();
        let output = artwork(&d, 236, 118).unwrap();
        assert!(output.pixels().any(|p| p[3] > 0 && p[3] < 255));
        assert!(output
            .pixels()
            .filter(|p| p[3] > 0)
            .all(|p| p[0] == 255 && p[2] == 0));
    }

    #[test]
    fn refuses_to_export_missing_requested_copies() {
        let f = Fixture::new();
        let mut d = f.png();
        d.quantity = 2;
        assert!(export(&f, &[sheet(&d)], &[d])
            .unwrap_err()
            .contains("todas las copias"));
        assert!(!f.0.join("output.png").exists());
    }

    #[test]
    fn real_default_size_export_has_expected_dimensions_and_transparency() {
        let f = Fixture::new();
        let d = f.png();
        let mut s = sheet(&d);
        s.width_cm = 60.0;
        s.height_cm = 100.0;
        let paths = export(&f, &[s], &[d]).unwrap();
        assert_eq!(image::image_dimensions(&paths[0]).unwrap(), (7087, 11811));
        let decoder =
            png::Decoder::new(std::io::BufReader::new(fs::File::open(&paths[0]).unwrap()));
        let mut reader = decoder.read_info().unwrap();
        assert_eq!(reader.info().color_type, png::ColorType::Rgba);
        let mut row = 0;
        while let Some(data) = reader.next_row().unwrap() {
            if row == 220 {
                assert_eq!(&data.data()[150 * 4..150 * 4 + 4], &[255, 0, 0, 128]);
            }
            if row == 11810 {
                assert!(data.data().iter().all(|v| *v == 0));
            }
            row += 1;
        }
        assert_eq!(row, 11811);
    }
}
