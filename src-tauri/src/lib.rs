mod commands;
mod domain;

use commands::{
    export::export_png,
    import::import_design,
    packing::run_packing,
    persistence::{load_job, save_job},
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            run_packing,
            export_png,
            save_job,
            load_job,
            import_design,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
