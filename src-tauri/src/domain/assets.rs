//! One resource and metadata policy for import, persistence, and export.
use super::design::{ImageFormat, VisibleBounds};
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::Path;

pub const MAX_ASSET_BYTES: u64 = 20 * 1024 * 1024;
pub const MAX_RASTER_PIXELS: u64 = 32_000_000;
pub const MAX_RASTER_SIDE: u32 = 16_384;
pub const EMPTY_ARTWORK_ERROR: &str = "El diseño no contiene arte visible.";
// Extra SVG layers have a separate aggregate budget (512 MB RGBA), including
// conservative filter scratch space. Export owns its destination canvas budget.
const MAX_SVG_LAYER_PIXELS: u64 = 128_000_000;

pub fn read_asset(path: &Path) -> Result<Vec<u8>, String> {
    let file =
        File::open(path).map_err(|_| "No se pudo abrir el archivo de diseño.".to_string())?;
    let metadata = file
        .metadata()
        .map_err(|_| "No se pudo leer el archivo de diseño.".to_string())?;
    if !metadata.is_file() || metadata.len() > MAX_ASSET_BYTES {
        return Err("El diseño no es un archivo o supera el límite de 20 MiB.".into());
    }
    let mut data = Vec::new();
    file.take(MAX_ASSET_BYTES + 1)
        .read_to_end(&mut data)
        .map_err(|_| "No se pudo leer el archivo de diseño.".to_string())?;
    if data.len() as u64 > MAX_ASSET_BYTES {
        return Err("El diseño supera el límite de 20 MiB.".into());
    }
    Ok(data)
}

pub fn check_raster_size(width: u32, height: u32) -> Result<(), String> {
    if width == 0
        || height == 0
        || width > MAX_RASTER_SIDE
        || height > MAX_RASTER_SIDE
        || u64::from(width) * u64::from(height) > MAX_RASTER_PIXELS
    {
        return Err(
            "La imagen supera las dimensiones permitidas (16384 px por lado y 32000000 píxeles)."
                .into(),
        );
    }
    Ok(())
}

fn scan_bounds(data: &[u8], width: u32, height: u32) -> Result<VisibleBounds, String> {
    let (mut left, mut top, mut right, mut bottom) = (width, height, 0, 0);
    for (index, pixel) in data.chunks_exact(4).enumerate() {
        if pixel[3] >= 3 {
            let x = index as u32 % width;
            let y = index as u32 / width;
            left = left.min(x);
            top = top.min(y);
            right = right.max(x + 1);
            bottom = bottom.max(y + 1);
        }
    }
    if right == 0 || bottom == 0 {
        return Err(EMPTY_ARTWORK_ERROR.into());
    }
    Ok(VisibleBounds {
        x_px: left as f64,
        y_px: top as f64,
        width_px: (right - left) as f64,
        height_px: (bottom - top) as f64,
        source_width_px: width as f64,
        source_height_px: height as f64,
    })
}

fn check_svg_layers(
    group: &resvg::usvg::Group,
    scale_x: f64,
    scale_y: f64,
    depth: usize,
    nodes: &mut usize,
    pixels: &mut u64,
) -> Result<(), String> {
    let error = || "El SVG supera la complejidad o memoria permitida.".to_string();
    if depth > 32 {
        return Err(error());
    }
    if group.should_isolate() {
        let bounds = group.abs_layer_bounding_box();
        // resvg expands integer layer origins by two pixels. Keep adversarial
        // translations away from i32 conversion/expansion overflow as well.
        for coordinate in [
            f64::from(bounds.x()) * scale_x,
            f64::from(bounds.y()) * scale_y,
        ] {
            if !coordinate.is_finite() || coordinate.abs() > 100_000_000.0 {
                return Err(error());
            }
        }
        let width = (f64::from(bounds.width()) * scale_x).ceil() + 4.0;
        let height = (f64::from(bounds.height()) * scale_y).ceil() + 4.0;
        if !width.is_finite() || !height.is_finite() || width > 32768.0 || height > 32768.0 {
            return Err(error());
        }
        let layer = width as u64 * height as u64;
        let primitives: usize = group.filters().iter().map(|f| f.primitives().len()).sum();
        if primitives > 32 {
            return Err(error());
        }
        let factor = if group.filters().is_empty() {
            1
        } else {
            16 + primitives as u64 * 4
        };
        *pixels = pixels.checked_add(layer * factor).ok_or_else(error)?;
        if *pixels > MAX_SVG_LAYER_PIXELS {
            return Err(error());
        }
    }
    for node in group.children() {
        *nodes += 1;
        if *nodes > 10_000 {
            return Err(error());
        }
        if let resvg::usvg::Node::Path(path) = node {
            if path
                .fill()
                .is_some_and(|f| matches!(f.paint(), resvg::usvg::Paint::Pattern(_)))
                || path
                    .stroke()
                    .is_some_and(|s| matches!(s.paint(), resvg::usvg::Paint::Pattern(_)))
            {
                return Err("El SVG contiene patrones no admitidos para un trabajo seguro.".into());
            }
        }
        if matches!(node, resvg::usvg::Node::Image(_)) {
            return Err(
                "El SVG contiene imágenes anidadas no admitidas para un trabajo seguro.".into(),
            );
        }
        if let resvg::usvg::Node::Group(child) = node {
            check_svg_layers(child, scale_x, scale_y, depth + 1, nodes, pixels)?;
        }
        let mut result = Ok(());
        node.subroots(|root| {
            if result.is_ok() {
                result = check_svg_layers(root, scale_x, scale_y, depth + 1, nodes, pixels);
            }
        });
        result?;
    }
    Ok(())
}

/// Validate extra rendering allocations at the actual positive X/Y scale. This
/// does not allocate or budget the destination canvas; the renderer must do that.
/// Translation and 90-degree rotation do not change the memory calculation.
pub fn validate_svg_tree_at_scale(
    tree: &resvg::usvg::Tree,
    scale_x: f32,
    scale_y: f32,
) -> Result<(), String> {
    if !scale_x.is_finite() || !scale_y.is_finite() || scale_x <= 0.0 || scale_y <= 0.0 {
        return Err("La escala de renderizado del SVG no es válida.".into());
    }
    check_svg_layers(
        tree.root(),
        f64::from(scale_x),
        f64::from(scale_y),
        0,
        &mut 0,
        &mut 0,
    )
}

/// External DOCTYPE identifiers are inert metadata in roxmltree (no resolver or
/// I/O). Reject internal subsets before enabling DTD syntax: no entity expansion,
/// parameter entities, or external entity declarations can enter the parser.
fn check_svg_doctype(text: &str) -> Result<(), String> {
    let error =
        || "El SVG contiene un DTD interno o declaraciones de entidades no admitidas.".to_string();
    if text.contains("<!ENTITY") {
        return Err(error());
    }
    // XML permits one declaration. A conservative duplicate rejection also
    // bounds this preflight to linear work, even for malformed quoted input.
    let mut declarations = text.match_indices("<!DOCTYPE");
    let declaration = declarations.next();
    if declarations.next().is_some() {
        return Err("El SVG contiene varias declaraciones DOCTYPE no admitidas.".into());
    }
    if let Some((start, _)) = declaration {
        let mut quote = None;
        for byte in text.as_bytes()[start + "<!DOCTYPE".len()..].iter().copied() {
            if let Some(delimiter) = quote {
                if byte == delimiter {
                    quote = None;
                }
                continue;
            }
            match byte {
                b'\'' | b'"' => quote = Some(byte),
                b'[' => return Err(error()),
                b'>' => break,
                _ => {}
            }
        }
    }
    Ok(())
}

/// Parse only uncompressed UTF-8 SVG without image resolvers. Never use default
/// usvg options for user-provided SVG: those may read files or decode unbounded
/// embedded images. The returned tree has been checked at intrinsic scale 1.
pub fn parse_svg(data: &[u8]) -> Result<resvg::usvg::Tree, String> {
    if data.len() as u64 > MAX_ASSET_BYTES {
        return Err("El SVG supera el límite de 20 MiB.".into());
    }
    let text =
        std::str::from_utf8(data).map_err(|_| "El SVG no es texto UTF-8 válido.".to_string())?;
    check_svg_doctype(text)?;
    let document = resvg::usvg::roxmltree::Document::parse_with_options(
        text,
        resvg::usvg::roxmltree::ParsingOptions {
            allow_dtd: true,
            nodes_limit: 10_000,
        },
    )
    .map_err(|_| "El SVG está dañado o supera la complejidad permitida.".to_string())?;
    for node in document.descendants() {
        if node.ancestors().take(34).count() > 33 {
            return Err("El SVG supera la profundidad permitida.".into());
        }
        if node.pi().is_some_and(|pi| pi.target == "xml-stylesheet") {
            return Err(
                "El SVG usa una hoja de estilos externa; incorpora sus estilos al archivo.".into(),
            );
        }
        if !node.is_element() {
            continue;
        }
        match node.tag_name().name() {
            "text" | "tspan" | "textPath" => return Err("El SVG contiene texto; convierte el texto a trazados antes de importarlo.".into()),
            "foreignObject" => return Err("El SVG contiene contenido HTML no admitido; conviértelo a trazados.".into()),
            "image" | "feImage" => return Err("El SVG contiene imágenes anidadas no admitidas; usa un PNG o trazados vectoriales.".into()),
            "script" => return Err("El SVG contiene scripts no admitidos; elimínalos antes de importarlo.".into()),
            "style" => check_css_resources(node.text().unwrap_or(""))?,
            _ => {},
        }
        for attribute in node.attributes() {
            if attribute.name() == "href" && !attribute.value().trim().starts_with('#') {
                return Err(
                    "El SVG contiene recursos enlazados; incorpora el contenido como trazados."
                        .into(),
                );
            }
            check_css_resources(attribute.value())?;
        }
    }
    let has_image = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let data_flag = has_image.clone();
    let string_flag = has_image.clone();
    let mut options = resvg::usvg::Options::default();
    options.image_href_resolver = resvg::usvg::ImageHrefResolver {
        resolve_data: Box::new(move |_, _, _| {
            data_flag.store(true, std::sync::atomic::Ordering::Relaxed);
            None
        }),
        resolve_string: Box::new(move |_, _| {
            string_flag.store(true, std::sync::atomic::Ordering::Relaxed);
            None
        }),
    };
    let tree = resvg::usvg::Tree::from_xmltree(&document, &options)
        .map_err(|_| "El SVG está dañado.".to_string())?;
    if has_image.load(std::sync::atomic::Ordering::Relaxed) {
        return Err(
            "El SVG contiene imágenes anidadas no admitidas para un trabajo seguro.".into(),
        );
    }
    check_raster_size(
        tree.size().width().ceil() as u32,
        tree.size().height().ceil() as u32,
    )?;
    validate_svg_tree_at_scale(&tree, 1.0, 1.0)?;
    Ok(tree)
}

fn check_css_resources(value: &str) -> Result<(), String> {
    let lower = value.to_ascii_lowercase();
    let error = || {
        "El SVG contiene estilos con recursos externos; incorpora sus estilos y convierte el texto a trazados.".to_string()
    };
    if lower.contains("@import") || lower.contains("@font-face") {
        return Err(error());
    }
    for (index, _) in lower.match_indices("url(") {
        let content = lower[index + 4..]
            .split(')')
            .next()
            .unwrap_or("")
            .trim()
            .trim_matches(['\'', '"']);
        if !content.starts_with('#') {
            return Err(error());
        }
    }
    Ok(())
}

/// Read and rescan a real PNG/SVG, never copying files or trusting JSON metadata.
/// Paths may be relative during import; persistence enforces absolute paths.
pub fn inspect_asset(path: &Path, format: &ImageFormat) -> Result<VisibleBounds, String> {
    let expected = match format {
        ImageFormat::Png => "png",
        ImageFormat::Svg => "svg",
    };
    if !path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case(expected))
    {
        return Err("El formato del diseño no coincide con su archivo.".into());
    }
    let bytes = read_asset(path)?;
    match format {
        ImageFormat::Png => {
            let mut reader =
                image::ImageReader::with_format(Cursor::new(bytes), image::ImageFormat::Png);
            let mut limits = image::Limits::default();
            limits.max_image_width = Some(MAX_RASTER_SIDE);
            limits.max_image_height = Some(MAX_RASTER_SIDE);
            limits.max_alloc = Some(MAX_RASTER_PIXELS * 8);
            reader.limits(limits);
            let decoder = reader
                .into_decoder()
                .map_err(|_| "El PNG está dañado o es demasiado grande.".to_string())?;
            use image::ImageDecoder;
            let (width, height) = decoder.dimensions();
            check_raster_size(width, height)?;
            let image = image::DynamicImage::from_decoder(decoder)
                .map_err(|_| "No se pudo decodificar el PNG.".to_string())?
                .into_rgba8();
            scan_bounds(image.as_raw(), width, height)
        }
        ImageFormat::Svg => {
            let tree = parse_svg(&bytes)?;
            let width = tree.size().width().ceil() as u32;
            let height = tree.size().height().ceil() as u32;
            let mut pixmap = resvg::tiny_skia::Pixmap::new(width, height)
                .ok_or_else(|| "No hay memoria suficiente para validar el SVG.".to_string())?;
            // Normalize the fractional intrinsic viewport to the integer metadata
            // raster. Preview/export map persisted bounds back proportionally.
            let scale_x = width as f32 / tree.size().width();
            let scale_y = height as f32 / tree.size().height();
            validate_svg_tree_at_scale(&tree, scale_x, scale_y)?;
            resvg::render(
                &tree,
                resvg::tiny_skia::Transform::from_scale(scale_x, scale_y),
                &mut pixmap.as_mut(),
            );
            scan_bounds(pixmap.data(), width, height)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn harmless_public_and_unreachable_external_svg_doctypes_render_without_resolution() {
        for doctype in [
            r#"<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">"#,
            r#"<!DOCTYPE svg SYSTEM "http://127.0.0.1:1/unreachable.dtd">"#,
            r#"<!DOCTYPE svg SYSTEM 'https://unreachable.invalid/[quoted]>resource.dtd'>"#,
        ] {
            let text = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>{doctype}<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><rect width="8" height="4" fill="red"/></svg>"#
            );
            let tree = parse_svg(text.as_bytes()).unwrap();
            let mut pixmap = resvg::tiny_skia::Pixmap::new(8, 4).unwrap();
            resvg::render(
                &tree,
                resvg::tiny_skia::Transform::identity(),
                &mut pixmap.as_mut(),
            );
            assert_eq!(&pixmap.data()[..4], &[255, 0, 0, 255]);
        }
    }

    #[test]
    fn rejects_all_internal_dtd_subsets_and_general_or_parameter_entity_definitions() {
        for declaration in [
            r#"<!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///forbidden.txt">]>"#,
            r#"<!DOCTYPE svg [<!ENTITY % external SYSTEM "file:///forbidden.dtd">%external;]>"#,
            r#"<!DOCTYPE svg [<!ENTITY a "expanded">]>"#,
            r#"<!DOCTYPE svg []>"#,
            r#"<!DOCTYPE svg SYSTEM "https://unreachable.invalid/external.dtd" [<!ENTITY a "expanded">]>"#,
            r#"<!DOCTYPE svg SYSTEM "quoted>[resource.dtd" [<!ENTITY % a SYSTEM "file:///forbidden.dtd">%a;]>"#,
            r#"<!ENTITY external SYSTEM "file:///forbidden.txt">"#,
        ] {
            let text = format!(
                r#"<?xml version="1.0"?>{declaration}<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><rect width="8" height="4"/></svg>"#
            );
            let error = parse_svg(text.as_bytes()).unwrap_err();
            assert!(
                error.contains("DTD interno") && error.contains("entidades"),
                "{error}"
            );
        }
        let undeclared = br#"<!DOCTYPE svg SYSTEM "http://127.0.0.1:1/unreachable.dtd"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><title>&external;</title><rect width="8" height="4"/></svg>"#;
        assert!(parse_svg(undeclared).is_err());
        assert!(parse_svg(br#"<!DOCTYPE svg SYSTEM "a"><!DOCTYPE svg SYSTEM "b"><svg xmlns="http://www.w3.org/2000/svg"/>"#).is_err());
    }

    struct Fixture(std::path::PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("dtfetris-assets-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn common_source_limits_are_explicit_and_include_previous_import_capacity() {
        assert_eq!(MAX_ASSET_BYTES, 20 * 1024 * 1024);
        assert!(check_raster_size(8000, 4000).is_ok());
        assert!(check_raster_size(8000, 4001).is_err());
        assert!(check_raster_size(16_384, 1).is_ok());
        assert!(check_raster_size(16_385, 1).is_err());
        assert!(check_raster_size(0, 1).is_err());
    }

    #[test]
    fn png_dimensions_are_bounded_before_pixel_decoding() {
        let f = Fixture::new();
        let path = f.0.join("large.png");
        image::RgbaImage::from_pixel(1, 1, image::Rgba([255, 0, 0, 255]))
            .save(&path)
            .unwrap();
        let original = fs::read(&path).unwrap();
        for (width, height) in [(16_385_u32, 1_u32), (8000, 4001)] {
            let mut data = original.clone();
            data[16..20].copy_from_slice(&width.to_be_bytes());
            data[20..24].copy_from_slice(&height.to_be_bytes());
            let mut crc = !0_u32;
            for byte in &data[12..29] {
                crc ^= u32::from(*byte);
                for _ in 0..8 {
                    crc = (crc >> 1) ^ (0xedb88320 & (0_u32.wrapping_sub(crc & 1)));
                }
            }
            data[29..33].copy_from_slice(&(!crc).to_be_bytes());
            fs::write(&path, data).unwrap();
            let error = inspect_asset(&path, &ImageFormat::Png).unwrap_err();
            assert!(
                !error.contains("decodificar"),
                "must fail before pixel decoding: {error}"
            );
        }
    }

    #[test]
    fn both_formats_reject_oversized_files_before_parsing() {
        let f = Fixture::new();
        for (name, format) in [
            ("large.png", ImageFormat::Png),
            ("large.svg", ImageFormat::Svg),
        ] {
            let path = f.0.join(name);
            File::create(&path)
                .unwrap()
                .set_len(MAX_ASSET_BYTES + 1)
                .unwrap();
            assert!(inspect_asset(&path, &format)
                .unwrap_err()
                .contains("20 MiB"));
        }
    }

    #[test]
    fn svg_policy_rejects_text_foreign_content_links_patterns_and_bombs() {
        for body in [
            "<rect width='5' height='5'/><text x='1' y='4'>Texto</text>",
            "<foreignObject width='5' height='5'><div>HTML</div></foreignObject>",
            "<image href='data:image/png;base64,AAAA' width='5' height='5'/>",
            "<image href='file:///missing.png' width='5' height='5'/>",
            "<use href='https://example.invalid/shape.svg#rect'/>",
            "<style>@import url('file:///missing.css');</style><rect width='5' height='5'/>",
            "<style>@font-face {font-family:test;src:url('file:///missing.ttf')}</style><rect width='5' height='5'/>",
            "<defs><pattern id='p' width='1000000' height='1000000' patternUnits='userSpaceOnUse'><rect width='5' height='5'/></pattern></defs><rect width='10' height='10' fill='url(#p)'/>",
        ] {
            let svg = format!("<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'>{body}</svg>");
            assert!(parse_svg(svg.as_bytes()).is_err(), "must reject {body}");
        }
        assert!(
            parse_svg(b"<svg xmlns='http://www.w3.org/2000/svg' width='8000' height='4001'/>")
                .is_err()
        );
        assert!(
            parse_svg(b"<svg xmlns='http://www.w3.org/2000/svg' width='16385' height='1'/>")
                .is_err()
        );
        let mixed = b"<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><rect width='5' height='5'/><text>Hola</text></svg>";
        assert!(parse_svg(mixed)
            .unwrap_err()
            .contains("convierte el texto a trazados"));
    }

    #[test]
    fn svg_scale_validation_accounts_for_intermediate_layers_not_just_viewport() {
        let tree = parse_svg(b"<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><g opacity='.5'><rect width='20' height='20'/></g></svg>").unwrap();
        assert!(validate_svg_tree_at_scale(&tree, 2.0, 3.0).is_ok());
        assert!(validate_svg_tree_at_scale(&tree, 1000.0, 1000.0).is_err());
        assert!(validate_svg_tree_at_scale(&tree, f32::INFINITY, 1.0).is_err());
        assert!(validate_svg_tree_at_scale(&tree, 0.0, 1.0).is_err());
        assert!(validate_svg_tree_at_scale(&tree, -1.0, 1.0).is_err());
    }

    #[test]
    fn fractional_svg_uses_normalized_integer_raster() {
        let f = Fixture::new();
        let path = f.0.join("fractional.svg");
        fs::write(&path, b"<svg xmlns='http://www.w3.org/2000/svg' width='12.5' height='7.5'><rect x='11.55' y='6.6' width='.9' height='.85' fill='red'/></svg>").unwrap();
        let bounds = inspect_asset(&path, &ImageFormat::Svg).unwrap();
        assert_eq!(
            (bounds.source_width_px, bounds.source_height_px),
            (13.0, 8.0)
        );
        assert_eq!(
            (bounds.x_px, bounds.y_px, bounds.width_px, bounds.height_px),
            (12.0, 7.0, 1.0, 1.0)
        );
    }
}
