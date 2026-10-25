fn main() {
    tauri_build::build();
    // Unit-test executables also link native dialogs through Tauri's mock
    // runtime. They need common-controls v6 just like the shipping app, or
    // Windows fails before the test harness starts (STATUS_ENTRYPOINT_NOT_FOUND).
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'");
        // tauri-build already embeds a manifest resource for binary targets.
        // Do not generate a second resource with the same ID there.
        println!("cargo:rustc-link-arg-bin=dtf-sheet-optimizer=/MANIFEST:NO");
        println!("cargo:rustc-link-arg-bin=dtfetris-mcp=/MANIFEST:NO");
    }
}
