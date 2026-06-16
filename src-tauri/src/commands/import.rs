use crate::domain::design::{DesignInput, ImageFormat, VisibleBounds};
use std::path::{Path, PathBuf};
use tauri::Manager;
use uuid::Uuid;

// ─── Error codes ────────────────────────────────────────────────────────────

/// Stable error codes returned to the frontend.
/// The UI is responsible for mapping these to Spanish user-facing messages.
#[derive(Debug, PartialEq)]
pub enum ImportError {
    InvalidFormat,
    InvalidDimensions,
    FileNotFound,
    CopyFailed,
    EmptyArtwork,
    MetadataFailed,
}

impl ImportError {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::InvalidFormat => "invalid_format",
            Self::InvalidDimensions => "invalid_dimensions",
            Self::FileNotFound => "file_not_found",
            Self::CopyFailed => "copy_failed",
            Self::EmptyArtwork => "empty_artwork",
            Self::MetadataFailed => "metadata_failed",
        }
    }
}

impl std::fmt::Display for ImportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

// ─── Image format detection ──────────────────────────────────────────────────

fn detect_format(path: &Path) -> Result<ImageFormat, ImportError> {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => Ok(ImageFormat::Png),
        Some("svg") => Ok(ImageFormat::Svg),
        _ => Err(ImportError::InvalidFormat),
    }
}

// ─── Visible bounds detection ────────────────────────────────────────────────

/// Scan RGBA bytes for the bounding box of non-transparent pixels.
/// `alpha_threshold`: minimum alpha value to count as visible.
/// Returns `(min_x, min_y, max_x, max_y)` or `None` if all pixels are transparent.
fn scan_alpha_bounds(
    data: &[u8],
    width: u32,
    height: u32,
    alpha_threshold: u8,
) -> Option<(u32, u32, u32, u32)> {
    let mut min_x = u32::MAX;
    let mut min_y = u32::MAX;
    let mut max_x = 0u32;
    let mut max_y = 0u32;
    let mut found = false;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            let alpha = data[idx + 3];
            if alpha >= alpha_threshold {
                if x < min_x {
                    min_x = x;
                }
                if x > max_x {
                    max_x = x;
                }
                if y < min_y {
                    min_y = y;
                }
                if y > max_y {
                    max_y = y;
                }
                found = true;
            }
        }
    }

    if found {
        Some((min_x, min_y, max_x, max_y))
    } else {
        None
    }
}

fn visible_bounds_from_rgba(
    data: &[u8],
    source_width: u32,
    source_height: u32,
    alpha_threshold: u8,
) -> Result<VisibleBounds, ImportError> {
    let bounds = scan_alpha_bounds(data, source_width, source_height, alpha_threshold)
        .ok_or(ImportError::EmptyArtwork)?;

    let (min_x, min_y, max_x, max_y) = bounds;
    Ok(VisibleBounds {
        x_px: min_x as f64,
        y_px: min_y as f64,
        width_px: (max_x - min_x + 1) as f64,
        height_px: (max_y - min_y + 1) as f64,
        source_width_px: source_width as f64,
        source_height_px: source_height as f64,
    })
}

/// Detect visible bounds for a PNG file.
fn detect_png_bounds(path: &Path) -> Result<VisibleBounds, ImportError> {
    let img = image::open(path)
        .map_err(|_| ImportError::MetadataFailed)?
        .into_rgba8();

    let (width, height) = (img.width(), img.height());
    let data = img.as_raw();
    // PNG: alpha >= 3/255 — matches the SVG scan threshold; filters subpixel noise
    visible_bounds_from_rgba(data, width, height, 3)
}

/// Detect visible bounds for an SVG file.
/// Rasterizes the SVG using its intrinsic size (or viewBox as pixels), then scans alpha.
fn detect_svg_bounds(path: &Path) -> Result<VisibleBounds, ImportError> {
    let svg_data = std::fs::read(path).map_err(|err| match err.kind() {
        std::io::ErrorKind::NotFound => ImportError::FileNotFound,
        _ => ImportError::MetadataFailed,
    })?;

    let opt = resvg::usvg::Options::default();
    let tree = resvg::usvg::Tree::from_data(&svg_data, &opt)
        .map_err(|_| ImportError::MetadataFailed)?;

    let svg_size = tree.size();
    let width = svg_size.width().ceil() as u32;
    let height = svg_size.height().ceil() as u32;

    if width == 0 || height == 0 {
        return Err(ImportError::EmptyArtwork);
    }

    let mut pixmap =
        resvg::tiny_skia::Pixmap::new(width, height).ok_or(ImportError::MetadataFailed)?;

    resvg::render(&tree, resvg::tiny_skia::Transform::identity(), &mut pixmap.as_mut());

    let data = pixmap.data();
    // SVG: alpha >= 3/255 to absorb rasterization anti-aliasing noise
    visible_bounds_from_rgba(data, width, height, 3)
}

// ─── Validation ──────────────────────────────────────────────────────────────

fn validate_dimensions(width_cm: f64, height_cm: f64) -> Result<(), ImportError> {
    if width_cm <= 0.0 || height_cm <= 0.0 || !width_cm.is_finite() || !height_cm.is_finite() {
        return Err(ImportError::InvalidDimensions);
    }
    Ok(())
}

// ─── Core import function (testable without Tauri AppHandle) ─────────────────

/// Import a design into `dest_dir/design-assets/{uuid}.{ext}`.
/// Returns the complete `DesignInput` on success.
/// Any partial copy is cleaned up on failure.
pub fn import_design_into(
    dest_dir: &Path,
    source_path: &str,
    width_cm: f64,
    height_cm: f64,
) -> Result<DesignInput, ImportError> {
    validate_dimensions(width_cm, height_cm)?;

    let source = Path::new(source_path);

    if !source.exists() {
        return Err(ImportError::FileNotFound);
    }

    let format = detect_format(source)?;

    // Detect visible bounds before copying to avoid partial copy on empty/malformed files.
    let visible_bounds = match format {
        ImageFormat::Png => detect_png_bounds(source),
        ImageFormat::Svg => detect_svg_bounds(source),
    }?;

    let original_aspect_ratio = visible_bounds.width_px / visible_bounds.height_px;

    let ext = match format {
        ImageFormat::Png => "png",
        ImageFormat::Svg => "svg",
    };

    let assets_dir = dest_dir.join("design-assets");
    std::fs::create_dir_all(&assets_dir).map_err(|_| ImportError::CopyFailed)?;

    let file_name = format!("{}.{}", Uuid::new_v4(), ext);
    let dest_path = assets_dir.join(&file_name);

    if let Err(_) = std::fs::copy(source, &dest_path) {
        // Clean up any partial copy.
        let _ = std::fs::remove_file(&dest_path);
        return Err(ImportError::CopyFailed);
    }

    let name = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("design")
        .to_string();

    let image_path = dest_path.to_string_lossy().into_owned();

    Ok(DesignInput {
        id: Uuid::new_v4().to_string(),
        name,
        image_path,
        width_cm,
        height_cm,
        format,
        visible_bounds,
        original_aspect_ratio,
        quantity: 1,
        can_rotate: true,
    })
}

// ─── Tauri command (thin wrapper that resolves app_data_dir) ─────────────────

#[tauri::command]
pub fn import_design(
    app: tauri::AppHandle,
    source_path: String,
    width_cm: f64,
    height_cm: f64,
) -> Result<DesignInput, String> {
    let dest_dir: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|_| "copy_failed".to_string())?;

    import_design_into(&dest_dir, &source_path, width_cm, height_cm)
        .map_err(|e| e.as_str().to_string())
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, RgbaImage};
    use std::io::Write;

    // ── Helpers ────────────────────────────────────────────────────────────

    fn temp_dir() -> std::path::PathBuf {
        let id = Uuid::new_v4().to_string();
        let dir = std::env::temp_dir().join(format!("dtfetris_test_{}", id));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// Build a 10×10 RGBA PNG with transparent padding (1 pixel on each side)
    /// and a red visible center (8×8).
    fn create_padded_png(path: &Path) {
        let mut img: RgbaImage = ImageBuffer::from_pixel(10, 10, [0u8, 0, 0, 0].into());
        for y in 1..9u32 {
            for x in 1..9u32 {
                img.put_pixel(x, y, [255, 0, 0, 255].into());
            }
        }
        img.save(path).unwrap();
    }

    /// Build a fully transparent PNG (all alpha = 0).
    fn create_transparent_png(path: &Path) {
        let img: RgbaImage = ImageBuffer::from_pixel(10, 10, [0u8, 0, 0, 0].into());
        img.save(path).unwrap();
    }

    /// Write garbage bytes to simulate a malformed PNG.
    fn create_malformed_png(path: &Path) {
        let mut f = std::fs::File::create(path).unwrap();
        f.write_all(b"not a png file garbage bytes!!").unwrap();
    }

    /// Minimal SVG with a red square surrounded by a transparent viewBox margin.
    fn svg_with_padding() -> &'static str {
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20">
  <rect x="5" y="5" width="10" height="10" fill="red"/>
</svg>"#
    }

    /// SVG with only a fully transparent rect.
    fn svg_fully_transparent() -> &'static str {
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20">
  <rect x="0" y="0" width="20" height="20" fill="none" opacity="0"/>
</svg>"#
    }

    // ── Task 2.1: PNG transparent padding — visible bounds ≠ full image ──

    #[test]
    fn png_visible_bounds_exclude_transparent_padding() {
        let dir = temp_dir();
        let png = dir.join("padded.png");
        create_padded_png(&png);

        let dest = temp_dir();
        let result = import_design_into(&dest, png.to_str().unwrap(), 10.0, 8.0)
            .expect("import succeeds");

        let vb = &result.visible_bounds;
        // The red area starts at x=1, y=1 and is 8×8, so bounds should NOT be the full 10×10.
        assert_eq!(vb.x_px, 1.0, "visible x starts after 1px transparent border");
        assert_eq!(vb.y_px, 1.0, "visible y starts after 1px transparent border");
        assert_eq!(vb.width_px, 8.0, "visible width excludes padding");
        assert_eq!(vb.height_px, 8.0, "visible height excludes padding");
        assert_eq!(vb.source_width_px, 10.0, "source width is full image");
        assert_eq!(vb.source_height_px, 10.0, "source height is full image");

        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&dest).ok();
    }

    // ── Task 2.1: Fully transparent PNG → empty_artwork error ────────────

    #[test]
    fn fully_transparent_png_returns_empty_artwork_error() {
        let dir = temp_dir();
        let png = dir.join("transparent.png");
        create_transparent_png(&png);

        let dest = temp_dir();
        let result = import_design_into(&dest, png.to_str().unwrap(), 10.0, 8.0);

        assert_eq!(
            result.unwrap_err(),
            ImportError::EmptyArtwork,
            "fully transparent PNG must return empty_artwork"
        );

        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&dest).ok();
    }

    // ── Task 2.1: Unsupported file extension → invalid_format ────────────

    #[test]
    fn unsupported_extension_returns_invalid_format_error() {
        let dir = temp_dir();
        let txt = dir.join("design.jpg");
        std::fs::write(&txt, b"fake jpg content").unwrap();

        let dest = temp_dir();
        let result = import_design_into(&dest, txt.to_str().unwrap(), 10.0, 8.0);

        assert_eq!(
            result.unwrap_err(),
            ImportError::InvalidFormat,
            "jpg extension must return invalid_format"
        );

        // Also test .txt
        let txt2 = dir.join("design.txt");
        std::fs::write(&txt2, b"not an image").unwrap();
        let result2 = import_design_into(&dest, txt2.to_str().unwrap(), 10.0, 8.0);
        assert_eq!(result2.unwrap_err(), ImportError::InvalidFormat);

        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&dest).ok();
    }

    // ── Task 2.1: Malformed / unreadable file → appropriate error ────────

    #[test]
    fn malformed_png_returns_metadata_failed_error() {
        let dir = temp_dir();
        let png = dir.join("malformed.png");
        create_malformed_png(&png);

        let dest = temp_dir();
        let result = import_design_into(&dest, png.to_str().unwrap(), 10.0, 8.0);

        assert_eq!(
            result.unwrap_err(),
            ImportError::MetadataFailed,
            "malformed PNG must return metadata_failed"
        );

        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&dest).ok();
    }

    #[test]
    fn missing_file_returns_file_not_found_error() {
        let dest = temp_dir();
        let result = import_design_into(&dest, "/nonexistent/path/design.png", 10.0, 8.0);

        assert_eq!(
            result.unwrap_err(),
            ImportError::FileNotFound,
            "missing file must return file_not_found"
        );

        std::fs::remove_dir_all(&dest).ok();
    }

    // ── Task 2.1: Duplicate imports produce distinct copy paths ──────────

    #[test]
    fn duplicate_imports_produce_distinct_copy_paths() {
        let dir = temp_dir();
        let png = dir.join("logo.png");
        create_padded_png(&png);

        let dest = temp_dir();
        let first =
            import_design_into(&dest, png.to_str().unwrap(), 10.0, 8.0).expect("first import");
        let second =
            import_design_into(&dest, png.to_str().unwrap(), 10.0, 8.0).expect("second import");

        assert_ne!(
            first.image_path, second.image_path,
            "duplicate imports must produce distinct copy paths"
        );
        assert_ne!(
            first.id, second.id,
            "duplicate imports must produce distinct IDs"
        );

        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&dest).ok();
    }

    // ── Task 2.1: SVG with surrounding whitespace → visible bounds detected

    #[test]
    fn svg_visible_bounds_exclude_transparent_padding() {
        let dir = temp_dir();
        let svg_path = dir.join("padded.svg");
        std::fs::write(&svg_path, svg_with_padding()).unwrap();

        let dest = temp_dir();
        let result = import_design_into(&dest, svg_path.to_str().unwrap(), 10.0, 10.0)
            .expect("SVG import succeeds");

        let vb = &result.visible_bounds;
        // The red rect is at x=5..15, y=5..15 in a 20×20 SVG.
        assert_eq!(vb.source_width_px, 20.0, "source width is SVG intrinsic width");
        assert_eq!(vb.source_height_px, 20.0, "source height is SVG intrinsic height");
        // Visible content starts at x=5, y=5 and is 10×10.
        assert_eq!(vb.x_px, 5.0, "SVG visible x starts at rect position");
        assert_eq!(vb.y_px, 5.0, "SVG visible y starts at rect position");
        assert_eq!(vb.width_px, 10.0, "SVG visible width matches rect width");
        assert_eq!(vb.height_px, 10.0, "SVG visible height matches rect height");

        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&dest).ok();
    }

    #[test]
    fn fully_transparent_svg_returns_empty_artwork_error() {
        let dir = temp_dir();
        let svg_path = dir.join("transparent.svg");
        std::fs::write(&svg_path, svg_fully_transparent()).unwrap();

        let dest = temp_dir();
        let result = import_design_into(&dest, svg_path.to_str().unwrap(), 10.0, 10.0);

        assert_eq!(
            result.unwrap_err(),
            ImportError::EmptyArtwork,
            "fully transparent SVG must return empty_artwork"
        );

        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&dest).ok();
    }

    // ── Task 2.1: Zero or negative widthCm/heightCm → invalid_dimensions ─

    #[test]
    fn zero_width_cm_returns_invalid_dimensions_error() {
        let dir = temp_dir();
        let png = dir.join("logo.png");
        create_padded_png(&png);

        let dest = temp_dir();
        let result = import_design_into(&dest, png.to_str().unwrap(), 0.0, 8.0);

        assert_eq!(
            result.unwrap_err(),
            ImportError::InvalidDimensions,
            "zero widthCm must return invalid_dimensions"
        );

        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&dest).ok();
    }

    #[test]
    fn negative_height_cm_returns_invalid_dimensions_error() {
        let dir = temp_dir();
        let png = dir.join("logo.png");
        create_padded_png(&png);

        let dest = temp_dir();
        let result = import_design_into(&dest, png.to_str().unwrap(), 10.0, -1.0);

        assert_eq!(
            result.unwrap_err(),
            ImportError::InvalidDimensions,
            "negative heightCm must return invalid_dimensions"
        );

        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&dest).ok();
    }

    // ── Task 2.1: No partial copy remains after a failed import ──────────

    #[test]
    fn no_copy_file_exists_when_import_fails_due_to_empty_artwork() {
        let dir = temp_dir();
        let png = dir.join("transparent.png");
        create_transparent_png(&png);

        let dest = temp_dir();
        let _ = import_design_into(&dest, png.to_str().unwrap(), 10.0, 8.0);

        let assets_dir = dest.join("design-assets");
        let orphan_count = if assets_dir.exists() {
            std::fs::read_dir(&assets_dir)
                .map(|entries| entries.count())
                .unwrap_or(0)
        } else {
            0
        };
        assert_eq!(orphan_count, 0, "no orphan copy should exist after failed import");

        std::fs::remove_dir_all(&dir).ok();
        std::fs::remove_dir_all(&dest).ok();
    }

    // ── Task 2.2: DesignInput camelCase serialization covers new fields ───

    #[test]
    fn design_input_with_new_fields_serializes_camel_case() {
        use crate::domain::design::{DesignInput, ImageFormat, VisibleBounds};
        use serde_json::json;

        let design = DesignInput {
            id: "d1".to_string(),
            name: "Test".to_string(),
            image_path: "/app/design-assets/abc.png".to_string(),
            width_cm: 10.0,
            height_cm: 8.0,
            format: ImageFormat::Png,
            visible_bounds: VisibleBounds {
                x_px: 1.0,
                y_px: 1.0,
                width_px: 8.0,
                height_px: 8.0,
                source_width_px: 10.0,
                source_height_px: 10.0,
            },
            original_aspect_ratio: 1.0,
            quantity: 1,
            can_rotate: true,
        };

        let value = serde_json::to_value(&design).expect("serializes");

        assert_eq!(value["format"], json!("png"), "format key must be camelCase");
        assert!(value.get("visibleBounds").is_some(), "visibleBounds key must be present");
        assert_eq!(
            value["visibleBounds"]["xPx"],
            json!(1.0),
            "nested field xPx must be camelCase"
        );
        assert_eq!(
            value["visibleBounds"]["widthPx"],
            json!(8.0),
            "nested field widthPx must be camelCase"
        );
        assert_eq!(
            value["visibleBounds"]["sourceWidthPx"],
            json!(10.0),
            "nested field sourceWidthPx must be camelCase"
        );
        assert_eq!(
            value["originalAspectRatio"],
            json!(1.0),
            "originalAspectRatio must be camelCase"
        );
    }

    // ── Error code strings match the stable contract ──────────────────────

    #[test]
    fn import_error_codes_match_stable_contract() {
        assert_eq!(ImportError::InvalidFormat.as_str(), "invalid_format");
        assert_eq!(ImportError::InvalidDimensions.as_str(), "invalid_dimensions");
        assert_eq!(ImportError::FileNotFound.as_str(), "file_not_found");
        assert_eq!(ImportError::CopyFailed.as_str(), "copy_failed");
        assert_eq!(ImportError::EmptyArtwork.as_str(), "empty_artwork");
        assert_eq!(ImportError::MetadataFailed.as_str(), "metadata_failed");
    }
}
