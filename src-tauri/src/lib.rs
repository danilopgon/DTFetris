mod commands;
mod domain;

use commands::{
    export::export_png,
    packing::run_packing,
    persistence::{load_job, save_job},
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            run_packing,
            export_png,
            save_job,
            load_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
