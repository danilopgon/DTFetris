#[tauri::command]
pub fn save_job(job: serde_json::Value, path: String) -> Result<(), String> {
    // TODO: implement with std::fs + serde_json
    let _ = (job, path);
    Ok(())
}

#[tauri::command]
pub fn load_job(path: String) -> Result<serde_json::Value, String> {
    // TODO: implement with std::fs + serde_json
    let _ = path;
    Ok(serde_json::Value::Null)
}
