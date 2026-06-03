use crate::domain::design::Sheet;

#[tauri::command]
pub fn export_png(sheets: Vec<Sheet>, output_path: String) -> Result<(), String> {
    // TODO: for each placement:
    //   - PNG files: composite directly with the `image` crate
    //   - SVG files: rasterize with resvg at 300 DPI, then composite with `image`
    let _ = (sheets, output_path);
    Ok(())
}
