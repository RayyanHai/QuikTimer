#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // Run as a menu-bar agent: no Dock icon, lives in the status bar.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Keep the process alive even though both windows start hidden;
            // the tray (built on the JS side) is the persistent UI.
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running QuikTimer");
}
