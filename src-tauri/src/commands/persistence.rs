use crate::domain::assets::inspect_asset;
use crate::domain::design::{parse_color_override, DesignInput};
use crate::domain::packing::SheetConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use uuid::Uuid;

const JOB_VERSION: u32 = 1;
const MAX_JSON_BYTES: u64 = 8 * 1024 * 1024;

struct BoundedJson(Vec<u8>);
impl Write for BoundedJson {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        if bytes.len() > MAX_JSON_BYTES as usize - self.0.len() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "El trabajo supera el tamaño permitido.",
            ));
        }
        self.0.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// Only editable inputs are persisted. The caller must regenerate the layout on load.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Job {
    pub version: u32,
    pub sheet_config: SheetConfig,
    pub designs: Vec<DesignInput>,
}

fn positive_integer(value: f64) -> bool {
    value.is_finite() && value > 0.0 && value.fract() == 0.0 && value <= u32::MAX as f64
}

fn read_bounded(path: &Path, limit: u64) -> Result<Vec<u8>, String> {
    let file = File::open(path).map_err(|_| "No se pudo abrir el archivo.".to_string())?;
    let metadata = file
        .metadata()
        .map_err(|_| "No se pudo leer el archivo.".to_string())?;
    if !metadata.is_file() || metadata.len() > limit {
        return Err("El archivo no es válido o supera el tamaño permitido.".into());
    }
    // `take` also protects against files growing after the metadata check.
    let mut bytes = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "No se pudo leer el archivo.".to_string())?;
    if bytes.len() as u64 > limit {
        return Err("El archivo supera el tamaño permitido.".into());
    }
    Ok(bytes)
}

fn validate_job(job: &Job) -> Result<(), String> {
    if job.version != JOB_VERSION {
        return Err("La versión del trabajo no es compatible.".into());
    }
    if !positive_integer(job.sheet_config.width_cm) || !positive_integer(job.sheet_config.height_cm)
    {
        return Err("Las dimensiones de plancha deben ser centímetros enteros positivos.".into());
    }
    let mut ids = HashSet::new();
    for design in &job.designs {
        parse_color_override(design.color_override.as_deref())?;
        if design.id.trim().is_empty()
            || design.name.trim().is_empty()
            || !ids.insert(design.id.trim())
        {
            return Err(
                "Los identificadores deben ser únicos y los nombres no pueden estar vacíos.".into(),
            );
        }
        if !positive_integer(design.width_cm)
            || !positive_integer(design.height_cm)
            || design.quantity == 0
        {
            return Err(
                "Las dimensiones y cantidades de diseño deben ser enteros positivos.".into(),
            );
        }
        let bounds = &design.visible_bounds;
        if ![bounds.x_px, bounds.y_px]
            .iter()
            .all(|v| v.is_finite() && *v >= 0.0 && v.fract() == 0.0)
            || ![
                bounds.width_px,
                bounds.height_px,
                bounds.source_width_px,
                bounds.source_height_px,
            ]
            .iter()
            .all(|v| positive_integer(*v))
            || bounds.x_px + bounds.width_px > bounds.source_width_px
            || bounds.y_px + bounds.height_px > bounds.source_height_px
            || !design.original_aspect_ratio.is_finite()
            || (design.original_aspect_ratio - bounds.width_px / bounds.height_px).abs()
                > 1e-10 * (bounds.width_px / bounds.height_px).max(1.0)
        {
            return Err("Los metadatos visibles del diseño no son válidos.".into());
        }
        let path = Path::new(&design.image_path);
        if !path.is_absolute() {
            return Err("La ruta del diseño debe ser absoluta.".into());
        }
        if inspect_asset(path, &design.format)? != *bounds {
            return Err(
                "El archivo del diseño ha cambiado desde su importación; vuelve a importarlo."
                    .into(),
            );
        }
    }
    // An empty design list is a valid editable job, not a packing request.
    Ok(())
}

struct TemporaryFile(PathBuf);
impl Drop for TemporaryFile {
    fn drop(&mut self) {
        // This path was reserved by us with create_new, never an existing user file.
        let _ = fs::remove_file(&self.0);
    }
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    // Do not overwrite an asset, symlink, directory, or other non-job target.
    if let Ok(metadata) = fs::symlink_metadata(path) {
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err("El destino no es un archivo de trabajo válido.".into());
        }
    }
    let temp_path = parent.join(format!(".dtfetris-{}.tmp", Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .map_err(|_| "No se pudo crear el archivo temporal del trabajo.".to_string())?;
    let temporary = TemporaryFile(temp_path);
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| {
            "No se pudo escribir el trabajo; se conserva el archivo anterior.".to_string()
        })?;
    drop(file);
    // std::fs::rename uses MoveFileExW(REPLACE_EXISTING) on Windows. If the
    // destination is locked or replacement unsupported, fail WITHOUT deleting it.
    fs::rename(&temporary.0, path).map_err(|_| {
        "No se pudo reemplazar el trabajo; se conserva el archivo anterior.".to_string()
    })?;
    Ok(())
}

#[tauri::command(async)]
pub fn save_job(job: Job, path: String) -> Result<(), String> {
    let mut buffer = BoundedJson(Vec::new());
    serde_json::to_writer_pretty(&mut buffer, &job).map_err(|_| {
        "No se pudo serializar el trabajo o supera el tamaño permitido.".to_string()
    })?;
    let bytes = buffer.0;
    validate_job(&job)?;
    let target = Path::new(&path);
    // Saving must never replace a referenced image. Replacing a hard link with
    // rename does not modify the asset's other link or its file contents.
    for design in &job.designs {
        if let (Ok(target), Ok(asset)) = (
            fs::canonicalize(target),
            fs::canonicalize(&design.image_path),
        ) {
            if target == asset {
                return Err("El trabajo no puede sobrescribir una imagen de diseño.".into());
            }
        }
    }
    if target
        .extension()
        .and_then(|s| s.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("png") || e.eq_ignore_ascii_case("svg"))
    {
        return Err("El trabajo no puede sobrescribir una imagen.".into());
    }
    write_atomic(target, &bytes)
}

#[tauri::command(async)]
pub fn load_job(path: String) -> Result<Job, String> {
    let bytes = read_bounded(Path::new(&path), MAX_JSON_BYTES)?;
    let job: Job = serde_json::from_slice(&bytes)
        .map_err(|_| "El archivo no contiene un trabajo JSON válido.".to_string())?;
    validate_job(&job)?;
    Ok(job)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::import::import_design_into;
    use crate::domain::assets::{check_raster_size, MAX_ASSET_BYTES, MAX_RASTER_SIDE};
    use crate::domain::design::ImageFormat;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("dtfetris-persistence-{}", Uuid::new_v4()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn path(&self, name: &str) -> String {
            self.0.join(name).to_str().unwrap().to_owned()
        }
        fn job(&self) -> Job {
            let mut png = image::RgbaImage::new(10, 8);
            for y in 1..7 {
                for x in 2..8 {
                    png.put_pixel(x, y, image::Rgba([255, 0, 0, 255]));
                }
            }
            png.save(self.0.join("logo.png")).unwrap();
            fs::write(self.0.join("vector.svg"), r#"<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect x="5" y="5" width="10" height="10" fill="red"/></svg>"#).unwrap();
            Job {
                version: JOB_VERSION,
                sheet_config: SheetConfig {
                    width_cm: 60.0,
                    height_cm: 100.0,
                },
                designs: vec![
                    import_design_into(&self.0, &self.path("logo.png"), 10.0, 8.0).unwrap(),
                    import_design_into(&self.0, &self.path("vector.svg"), 12.0, 12.0).unwrap(),
                ],
            }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn roundtrip_imported_png_svg_and_overwrite_only_inputs() {
        let f = Fixture::new();
        let mut job = f.job();
        let assets: Vec<_> = job
            .designs
            .iter()
            .map(|d| fs::read(&d.image_path).unwrap())
            .collect();
        save_job(job.clone(), f.path("job.json")).unwrap();
        job.designs[0].quantity = 3;
        save_job(job.clone(), f.path("job.json")).unwrap();
        let loaded = load_job(f.path("job.json")).unwrap();
        assert_eq!(
            serde_json::to_value(&loaded).unwrap(),
            serde_json::to_value(&job).unwrap()
        );
        let value: serde_json::Value =
            serde_json::from_slice(&fs::read(f.path("job.json")).unwrap()).unwrap();
        assert_eq!(value.as_object().unwrap().len(), 3);
        assert!(value.get("sheetConfig").is_some());
        assert!(value.get("sheets").is_none());
        for (d, bytes) in loaded.designs.iter().zip(assets) {
            assert_eq!(fs::read(&d.image_path).unwrap(), bytes);
        }
        assert!(!fs::read_dir(&f.0).unwrap().any(|e| e
            .unwrap()
            .path()
            .extension()
            .is_some_and(|s| s == "tmp")));
    }

    #[test]
    fn empty_job_roundtrips() {
        let f = Fixture::new();
        let job = Job {
            version: 1,
            sheet_config: SheetConfig {
                width_cm: 1.0,
                height_cm: 2.0,
            },
            designs: vec![],
        };
        save_job(job, f.path("empty.json")).unwrap();
        assert!(load_job(f.path("empty.json")).unwrap().designs.is_empty());
    }

    #[test]
    fn overrides_roundtrip_for_png_svg_and_clear_without_modifying_assets() {
        let f = Fixture::new();
        let mut job = f.job();
        let originals: Vec<_> = job
            .designs
            .iter()
            .map(|d| fs::read(&d.image_path).unwrap())
            .collect();
        for design in &mut job.designs {
            design.color_override = Some("#aB09fF".into());
        }
        save_job(job.clone(), f.path("colors.json")).unwrap();
        let mut loaded = load_job(f.path("colors.json")).unwrap();
        assert_eq!(
            serde_json::to_value(&loaded).unwrap(),
            serde_json::to_value(&job).unwrap()
        );
        for (design, bytes) in loaded.designs.iter_mut().zip(originals) {
            assert_eq!(design.color_override.as_deref(), Some("#aB09fF"));
            assert_eq!(fs::read(&design.image_path).unwrap(), bytes);
            design.color_override = None;
        }
        save_job(loaded, f.path("colors.json")).unwrap();
        let cleared: serde_json::Value =
            serde_json::from_slice(&fs::read(f.path("colors.json")).unwrap()).unwrap();
        assert!(cleared["designs"]
            .as_array()
            .unwrap()
            .iter()
            .all(|d| d.get("colorOverride").is_none()));
        assert!(load_job(f.path("colors.json"))
            .unwrap()
            .designs
            .iter()
            .all(|d| d.color_override.is_none()));
    }

    #[test]
    fn old_v1_job_without_color_override_loads_and_resaves_without_new_keys() {
        let f = Fixture::new();
        let job = f.job();
        let mut old = serde_json::to_value(&job).unwrap();
        for design in old["designs"].as_array_mut().unwrap() {
            design.as_object_mut().unwrap().remove("colorOverride");
        }
        fs::write(f.path("old.json"), serde_json::to_vec(&old).unwrap()).unwrap();
        let loaded = load_job(f.path("old.json")).unwrap();
        assert!(loaded.designs.iter().all(|d| d.color_override.is_none()));
        save_job(loaded, f.path("resaved.json")).unwrap();
        let resaved: serde_json::Value =
            serde_json::from_slice(&fs::read(f.path("resaved.json")).unwrap()).unwrap();
        assert_eq!(resaved, old);
    }

    #[test]
    fn invalid_color_rejected_on_save_and_load_preserves_previous_job() {
        let f = Fixture::new();
        let mut job = f.job();
        save_job(job.clone(), f.path("job.json")).unwrap();
        let original = fs::read(f.path("job.json")).unwrap();
        for invalid in ["", "#123", "#12345678", "#zz0000", " #123456"] {
            job.designs[0].color_override = Some(invalid.into());
            assert!(save_job(job.clone(), f.path("job.json"))
                .unwrap_err()
                .contains("#RRGGBB"));
            assert_eq!(fs::read(f.path("job.json")).unwrap(), original);
            fs::write(f.path("invalid.json"), serde_json::to_vec(&job).unwrap()).unwrap();
            assert!(load_job(f.path("invalid.json"))
                .unwrap_err()
                .contains("#RRGGBB"));
        }
    }

    #[test]
    fn invalid_json_version_and_untrusted_layout_are_rejected() {
        let f = Fixture::new();
        for json in [
            "not json",
            "null",
            r#"{"version":2,"sheetConfig":{"widthCm":60,"heightCm":100},"designs":[]}"#,
            r#"{"version":1,"sheetConfig":{"widthCm":60,"heightCm":100},"designs":[],"sheets":[]}"#,
        ] {
            fs::write(f.path("bad.json"), json).unwrap();
            assert!(load_job(f.path("bad.json")).is_err());
        }
        assert!(load_job(f.path("missing.json")).is_err());
    }

    #[test]
    fn validation_failures_preserve_previous_job() {
        let f = Fixture::new();
        let job = f.job();
        save_job(job.clone(), f.path("job.json")).unwrap();
        let original = fs::read(f.path("job.json")).unwrap();
        let mut invalid = Vec::new();
        let mut j = job.clone();
        j.version = 0;
        invalid.push(j);
        let mut j = job.clone();
        j.sheet_config.width_cm = 0.0;
        invalid.push(j);
        let mut j = job.clone();
        j.designs[0].width_cm = 1.5;
        invalid.push(j);
        let mut j = job.clone();
        j.designs[0].quantity = 0;
        invalid.push(j);
        let mut j = job.clone();
        j.designs[0].name = " ".into();
        invalid.push(j);
        let mut j = job.clone();
        j.designs[1].id = j.designs[0].id.clone();
        invalid.push(j);
        let mut j = job.clone();
        j.designs[0].visible_bounds.x_px = 0.5;
        invalid.push(j);
        let mut j = job.clone();
        j.designs[0].visible_bounds.width_px = 100.0;
        invalid.push(j);
        let mut j = job.clone();
        j.designs[0].original_aspect_ratio = 2.0;
        invalid.push(j);
        let mut j = job.clone();
        j.designs[0].image_path = "relative.png".into();
        invalid.push(j);
        let mut j = job.clone();
        j.designs[0].format = ImageFormat::Svg;
        invalid.push(j);
        for bad in invalid {
            assert!(save_job(bad.clone(), f.path("job.json")).is_err());
            assert_eq!(fs::read(f.path("job.json")).unwrap(), original);
            fs::write(f.path("invalid.json"), serde_json::to_vec(&bad).unwrap()).unwrap();
            assert!(load_job(f.path("invalid.json")).is_err());
        }
    }

    #[test]
    fn missing_corrupt_changed_and_empty_sources_rejected_on_load_and_save() {
        let f = Fixture::new();
        let job = f.job();
        save_job(job.clone(), f.path("job.json")).unwrap();
        let saved = fs::read(f.path("job.json")).unwrap();
        let asset = &job.designs[0].image_path;
        let original = fs::read(asset).unwrap();
        fs::remove_file(asset).unwrap(); // own fixture only
        assert!(load_job(f.path("job.json")).is_err());
        assert!(save_job(job.clone(), f.path("job.json")).is_err());
        fs::write(asset, b"broken PNG").unwrap();
        assert!(load_job(f.path("job.json")).is_err());
        assert!(save_job(job.clone(), f.path("job.json")).is_err());
        image::RgbaImage::from_pixel(10, 8, image::Rgba([0, 0, 255, 255]))
            .save(asset)
            .unwrap();
        assert!(load_job(f.path("job.json")).is_err());
        assert!(save_job(job.clone(), f.path("job.json")).is_err());
        image::RgbaImage::new(10, 8).save(asset).unwrap();
        assert!(load_job(f.path("job.json")).is_err());
        assert!(save_job(job.clone(), f.path("job.json")).is_err());
        assert_eq!(fs::read(f.path("job.json")).unwrap(), saved);
        fs::write(asset, original).unwrap();
        let svg = &job.designs[1].image_path;
        fs::write(svg, "<svg invalid").unwrap();
        assert!(load_job(f.path("job.json")).is_err());
        assert!(save_job(job, f.path("job.json")).is_err());
    }

    #[test]
    fn bounded_json_and_svg_raster_and_asset_overwrite() {
        let f = Fixture::new();
        let job = f.job();
        let file = File::create(f.path("large.json")).unwrap();
        file.set_len(MAX_JSON_BYTES + 1).unwrap();
        assert!(load_job(f.path("large.json")).is_err());
        assert!(save_job(job.clone(), job.designs[0].image_path.clone()).is_err());
        let svg = &job.designs[1].image_path;
        fs::write(svg, r#"<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"><rect width="100000" height="100000"/></svg>"#).unwrap();
        assert!(save_job(job.clone(), f.path("job.json")).is_err());
        fs::write(svg, r#"<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><image href="file:///missing.png" width="20" height="20"/></svg>"#).unwrap();
        assert!(save_job(job, f.path("job.json")).is_err());
    }

    #[test]
    fn oversized_assets_output_and_svg_patterns_are_rejected() {
        let f = Fixture::new();
        let mut job = f.job();
        let asset = &job.designs[0].image_path;
        let original = fs::read(asset).unwrap();
        File::create(asset)
            .unwrap()
            .set_len(MAX_ASSET_BYTES + 1)
            .unwrap();
        assert!(save_job(job.clone(), f.path("job.json")).is_err());
        fs::write(asset, original).unwrap();
        job.designs[0].name = "x".repeat(MAX_JSON_BYTES as usize);
        assert!(save_job(job.clone(), f.path("job.json")).is_err());
        job.designs[0].name = "Logo".into();
        fs::write(&job.designs[1].image_path, r#"<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><defs><pattern id="p" width="1000000" height="1000000" patternUnits="userSpaceOnUse"><rect width="10" height="10"/></pattern></defs><rect width="20" height="20" fill="url(#p)"/></svg>"#).unwrap();
        assert!(save_job(job, f.path("job.json")).is_err());
        assert!(check_raster_size(MAX_RASTER_SIDE + 1, 1).is_err());
        assert!(check_raster_size(5657, 5657).is_err());
    }

    #[test]
    fn duplicate_names_and_shared_image_paths_roundtrip() {
        let f = Fixture::new();
        let mut job = f.job();
        let mut duplicate = job.designs[0].clone();
        duplicate.id = Uuid::new_v4().to_string();
        job.designs.push(duplicate);
        // Importing the same source again also keeps its display name, but has
        // its own asset copy. Both cases are valid editable designs.
        job.designs
            .push(import_design_into(&f.0, &f.path("logo.png"), 5.0, 5.0).unwrap());
        save_job(job.clone(), f.path("duplicates.json")).unwrap();
        let loaded = load_job(f.path("duplicates.json")).unwrap();
        assert_eq!(loaded.designs[0].name, loaded.designs[2].name);
        assert_eq!(loaded.designs[0].image_path, loaded.designs[2].image_path);
        assert_eq!(loaded.designs[0].name, loaded.designs[3].name);
        assert_ne!(loaded.designs[0].image_path, loaded.designs[3].image_path);
        assert_eq!(
            serde_json::to_value(loaded).unwrap(),
            serde_json::to_value(job).unwrap()
        );
    }

    #[test]
    fn fractional_svg_normalized_metadata_survives_import_save_load() {
        let f = Fixture::new();
        fs::write(f.path("fractional.svg"), r#"<svg xmlns="http://www.w3.org/2000/svg" width="12.5" height="7.5"><rect x="11.55" y="6.6" width="0.9" height="0.85" fill="red"/></svg>"#).unwrap();
        let design = import_design_into(&f.0, &f.path("fractional.svg"), 12.0, 8.0).unwrap();
        let bounds = &design.visible_bounds;
        assert_eq!(
            (bounds.source_width_px, bounds.source_height_px),
            (13.0, 8.0)
        );
        // The normalized narrow edge extends into the last raster column/row;
        // identity rasterization would also include column 11 and row 6.
        assert_eq!(
            (bounds.x_px, bounds.y_px, bounds.width_px, bounds.height_px),
            (12.0, 7.0, 1.0, 1.0)
        );
        let job = Job {
            version: 1,
            sheet_config: SheetConfig {
                width_cm: 60.0,
                height_cm: 100.0,
            },
            designs: vec![design],
        };
        save_job(job.clone(), f.path("fractional.json")).unwrap();
        let loaded = load_job(f.path("fractional.json")).unwrap();
        assert_eq!(
            loaded.designs[0].visible_bounds,
            job.designs[0].visible_bounds
        );
    }

    #[test]
    fn failed_commit_preserves_existing_target_and_cleans_temporary_file() {
        let f = Fixture::new();
        fs::create_dir(f.path("directory.json")).unwrap();
        fs::write(f.0.join("directory.json").join("keep"), "keep").unwrap();
        assert!(write_atomic(Path::new(&f.path("directory.json")), b"new").is_err());
        assert_eq!(
            fs::read(f.0.join("directory.json").join("keep")).unwrap(),
            b"keep"
        );
        assert!(write_atomic(Path::new(&f.path("missing/job.json")), b"new").is_err());
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            fs::write(f.path("locked.json"), b"old job").unwrap();
            let _lock = OpenOptions::new()
                .read(true)
                .share_mode(1)
                .open(f.path("locked.json"))
                .unwrap();
            assert!(write_atomic(Path::new(&f.path("locked.json")), b"new job").is_err());
            assert_eq!(fs::read(f.path("locked.json")).unwrap(), b"old job");
        }
        assert!(!fs::read_dir(&f.0).unwrap().any(|e| e
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".dtfetris-")));
    }
}
