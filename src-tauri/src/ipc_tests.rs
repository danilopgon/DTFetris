//! Exercise generated Tauri handlers with the JSON envelopes used by TypeScript.
//! Only the runtime/webview is mocked: commands, assets and filesystem are real.
use crate::commands::import::import_design_into;
use crate::domain::design::{DesignInput, ImageFormat};
use serde_json::{json, Value};
use std::{fs, io::BufReader, path::PathBuf};
use tauri::{
    ipc::{CallbackFn, InvokeBody},
    test::{get_ipc_response, mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY},
    webview::InvokeRequest,
    WebviewWindow,
};

fn app() -> (tauri::App<MockRuntime>, WebviewWindow<MockRuntime>) {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![
            crate::commands::packing::run_packing,
            crate::commands::export::export_png,
            crate::commands::persistence::save_job,
            crate::commands::persistence::load_job
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    (app, window)
}

fn invoke(window: &WebviewWindow<MockRuntime>, command: &str, body: Value) -> Result<Value, Value> {
    get_ipc_response(
        window,
        InvokeRequest {
            cmd: command.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.into(),
        },
    )
    .map(|response| response.deserialize::<Value>().unwrap())
}

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("LOCALAPPDATA")
            .map(|path| PathBuf::from(path).join("Temp/opencode"))
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!("dtfetris-ipc-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }

    fn path(&self, name: &str) -> String {
        self.0.join(name).to_str().unwrap().to_owned()
    }

    fn job(&self) -> Value {
        let mut png = image::RgbaImage::new(12, 10);
        for y in 3..7 {
            for x in 2..10 {
                png.put_pixel(x, y, image::Rgba([255, 0, 0, 255]));
            }
        }
        png.save(self.path("origen.png")).unwrap();
        fs::write(self.path("origen.svg"), r#"<svg xmlns="http://www.w3.org/2000/svg" width="12" height="10"><rect x="2" y="3" width="8" height="4" fill="blue"/></svg>"#).unwrap();
        let designs: Vec<Value> = ["origen.png", "origen.svg"]
            .into_iter()
            .map(|name| {
                let design =
                    import_design_into(&self.0.join("privado"), &self.path(name), 2.0, 1.0)
                        .unwrap();
                assert!(PathBuf::from(&design.image_path).starts_with(self.0.join("privado")));
                frontend_design(&design)
            })
            .collect();
        // Prove subsequent commands consume private copies, not original inputs.
        fs::remove_file(self.path("origen.png")).unwrap();
        fs::remove_file(self.path("origen.svg")).unwrap();
        json!({
            "version": 1,
            "sheetConfig": {"widthCm": 3.0, "heightCm": 3.0},
            "designs": designs
        })
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        // Remove only this test's UUID-owned directory, never application data.
        let _ = fs::remove_dir_all(&self.0);
    }
}

// Deliberately spell the frontend keys rather than serialize the Rust struct:
// a serde naming regression must not silently update both sides of this test.
fn frontend_design(d: &DesignInput) -> Value {
    let b = &d.visible_bounds;
    json!({
        "id": d.id, "name": d.name, "imagePath": d.image_path,
        "widthCm": d.width_cm, "heightCm": d.height_cm,
        "format": match d.format { ImageFormat::Png => "png", ImageFormat::Svg => "svg" },
        "visibleBounds": {
            "xPx": b.x_px, "yPx": b.y_px, "widthPx": b.width_px,
            "heightPx": b.height_px, "sourceWidthPx": b.source_width_px,
            "sourceHeightPx": b.source_height_px
        },
        "originalAspectRatio": d.original_aspect_ratio,
        "quantity": d.quantity, "canRotate": d.can_rotate
    })
}

fn pack(window: &WebviewWindow<MockRuntime>, job: &Value) -> Value {
    invoke(
        window,
        "run_packing",
        json!({"request": {
            "sheet": job["sheetConfig"], "designs": job["designs"]
        }}),
    )
    .unwrap()
}

#[test]
fn ipc_tests_pack_export_save_load_repack_reexport_real_png_and_svg() {
    let fixture = Fixture::new();
    let job = fixture.job();
    let (_app, window) = app();
    let packed = pack(&window, &job);
    assert_eq!(packed["unplacedItems"], json!([]));
    assert!(packed.get("unplaced_items").is_none());
    assert_eq!(packed["sheets"].as_array().unwrap().len(), 1);
    let sheet = &packed["sheets"][0];
    assert_eq!(sheet["widthCm"], 3.0);
    assert_eq!(sheet["heightCm"], 3.0);
    let placements = sheet["placements"].as_array().unwrap();
    assert_eq!(placements.len(), 2);
    for p in placements {
        for key in ["designId", "xCm", "yCm", "widthCm", "heightCm", "rotated"] {
            assert!(p.get(key).is_some(), "missing frontend placement key {key}");
        }
    }
    let export = |packed: &Value, job: &Value, name: &str| {
        invoke(
            &window,
            "export_png",
            json!({
                "sheets": packed["sheets"], "designs": job["designs"],
                "outputPath": fixture.path(name)
            }),
        )
        .unwrap()
    };
    let paths = export(&packed, &job, "antes.png");
    assert_eq!(paths.as_array().unwrap().len(), 1);
    let before_path = paths[0].as_str().unwrap();
    let before = image::open(before_path).unwrap().into_rgba8();
    // 3 cm at 300 DPI, rounded to the nearest pixel, not preview resolution.
    assert_eq!(before.dimensions(), (354, 354));
    let reader = png::Decoder::new(BufReader::new(fs::File::open(before_path).unwrap()))
        .read_info()
        .unwrap();
    let density = reader.info().pixel_dims.unwrap();
    assert_eq!((density.xppu, density.yppu), (11811, 11811));
    assert_eq!(density.unit, png::Unit::Meter);
    assert!(before.pixels().any(|p| p.0 == [255, 0, 0, 255]));
    assert!(before.pixels().any(|p| p.0 == [0, 0, 255, 255]));
    assert!(before.pixels().any(|p| p[3] == 0));

    let saved = invoke(
        &window,
        "save_job",
        json!({
            "job": job, "path": fixture.path("trabajo.json")
        }),
    )
    .unwrap();
    assert_eq!(saved, Value::Null); // Promise<void>, not a placeholder status.
    let disk: Value =
        serde_json::from_slice(&fs::read(fixture.path("trabajo.json")).unwrap()).unwrap();
    let loaded = invoke(
        &window,
        "load_job",
        json!({"path": fixture.path("trabajo.json")}),
    )
    .unwrap();
    assert_eq!(loaded, disk);
    assert_eq!(loaded, job);
    assert!(loaded.get("sheets").is_none());
    assert!(loaded.get("sheet_config").is_none());
    let repacked = pack(&window, &loaded);
    assert_eq!(repacked, packed);
    let after_paths = export(&repacked, &loaded, "despues.png");
    let after_path = after_paths[0].as_str().unwrap();
    assert_eq!(image::open(after_path).unwrap().into_rgba8(), before);
    assert_eq!(
        fs::read(after_path).unwrap(),
        fs::read(before_path).unwrap()
    );
}

#[test]
fn ipc_tests_rejected_requests_reach_tauri_error_response() {
    let fixture = Fixture::new();
    let job = fixture.job();
    let (_app, window) = app();
    let mut invalid = job.clone();
    invalid["sheetConfig"]["widthCm"] = json!(0);
    assert_eq!(
        invoke(
            &window,
            "run_packing",
            json!({"request": {
                "sheet": invalid["sheetConfig"], "designs": invalid["designs"]
            }})
        )
        .unwrap_err(),
        json!("invalid_dimensions")
    );
    // Malformed JSON shape is rejected by the generated command argument decoder.
    let malformed = invoke(
        &window,
        "run_packing",
        json!({"request": {
            "sheet": {"width_cm": 3, "height_cm": 3}, "designs": job["designs"]
        }}),
    )
    .unwrap_err();
    assert!(malformed.as_str().unwrap().contains("widthCm"));

    let packed = pack(&window, &job);
    let failed_export = invoke(
        &window,
        "export_png",
        json!({
            "sheets": packed["sheets"], "designs": job["designs"],
            "outputPath": fixture.path("inexistente/salida.png")
        }),
    )
    .unwrap_err();
    assert!(!failed_export.as_str().unwrap().is_empty());
    assert!(!fixture.0.join("inexistente/salida.png").exists());
    let failed_save = invoke(
        &window,
        "save_job",
        json!({
            "job": job, "path": fixture.path("inexistente/trabajo.json")
        }),
    )
    .unwrap_err();
    assert!(!failed_save.as_str().unwrap().is_empty());
    let missing = invoke(
        &window,
        "load_job",
        json!({"path": fixture.path("ausente.json")}),
    )
    .unwrap_err();
    assert!(!missing.as_str().unwrap().is_empty());
    fs::write(fixture.path("corrupto.json"), b"{not-json}").unwrap();
    let corrupt = invoke(
        &window,
        "load_job",
        json!({"path": fixture.path("corrupto.json")}),
    )
    .unwrap_err();
    assert!(corrupt.as_str().unwrap().contains("JSON"));
    // An error must not poison dispatch: subsequent valid requests still succeed.
    assert_eq!(pack(&window, &job), packed);
}
