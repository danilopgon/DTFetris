use crate::domain::design::{DesignInput, Sheet};

#[tauri::command]
pub fn run_packing(
    designs: Vec<DesignInput>,
    sheet_width: f64,
    sheet_height: f64,
) -> Result<Vec<Sheet>, String> {
    // TODO: implement MaxRects algorithm
    let _ = (designs, sheet_width, sheet_height);
    Ok(vec![])
}
