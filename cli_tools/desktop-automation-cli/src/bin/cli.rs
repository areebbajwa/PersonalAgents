use clap::{Parser, Subcommand};
use computer_use_cli::Desktop;
use serde_json::json;
use std::process::Command;
use tracing_subscriber::fmt;

#[derive(Parser)]
#[command(name = "cli")]
#[command(about = "Desktop UI automation CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Open a URL in the default browser
    OpenUrl {
        url: String,
        #[arg(long)]
        browser: Option<String>,
    },
    /// Open an application by name
    OpenApp {
        #[arg(long)]
        app_name: String,
    },
    /// List elements for an application
    ListElements {
        #[arg(long)]
        app_name: Option<String>,
    },
    /// Click on an element by index
    Click {
        index: usize,
    },
    /// Type text into an element by index
    Type {
        index: usize,
        text: String,
    },
    /// Press a key combination on an element by index
    PressKey {
        index: usize,
        key: String,
    },
    /// Direct input control (AppleScript-based)
    Input {
        action: String, // "writetext", "keypress", "click"
        data: String,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    fmt::init();

    #[cfg(target_os = "macos")]
    {
        use computer_use_cli::platforms::macos::check_accessibility_permissions;
        
        match check_accessibility_permissions(true) {
            Ok(granted) => {
                if granted {
                    tracing::info!("accessibility permissions already granted");
                } else {
                    tracing::warn!("accessibility permissions not granted - some features may not work");
                }
            },
            Err(e) => {
                tracing::error!("failed to check accessibility permissions: {}", e);
            }
        }
    }

    let cli = Cli::parse();

    match cli.command {
        Commands::OpenUrl { url, browser } => {
            let desktop = Desktop::new(false, true)?;
            match desktop.open_url(&url, browser.as_deref()) {
                Ok(_) => {
                    println!("{}", json!({
                        "success": true,
                        "message": format!("Opened URL: {}", url)
                    }));
                },
                Err(e) => {
                    println!("{}", json!({
                        "success": false,
                        "error": format!("Failed to open URL: {}", e)
                    }));
                }
            }
        },
        Commands::OpenApp { app_name } => {
            let desktop = Desktop::new(false, true)?;
            match desktop.open_application(&app_name) {
                Ok(_) => {
                    println!("{}", json!({
                        "success": true,
                        "message": format!("Opened application: {}", app_name)
                    }));
                },
                Err(e) => {
                    println!("{}", json!({
                        "success": false,
                        "error": format!("Failed to open application: {}", e)
                    }));
                }
            }
        },
        Commands::ListElements { app_name } => {
            let desktop = Desktop::new(false, true)?;
            
            let target_app = app_name.unwrap_or_else(|| "Chrome".to_string());
            
            match desktop.application(&target_app) {
                Ok(app) => {
                    let all_elements = desktop.locator("*").all().unwrap_or_default();
                    let mut element_list = Vec::new();
                    
                    for (i, element) in all_elements.iter().enumerate() {
                        let role = element.role();
                        let text = element.text(5).unwrap_or_default();
                        element_list.push(json!({
                            "index": i,
                            "role": role,
                            "text": text
                        }));
                    }
                    
                    println!("{}", json!({
                        "success": true,
                        "elements": {
                            "count": element_list.len(),
                            "elements": element_list
                        }
                    }));
                },
                Err(e) => {
                    println!("{}", json!({
                        "success": false,
                        "error": format!("Failed to get application: {}", e)
                    }));
                }
            }
        },
        Commands::Click { index } => {
            println!("{}", json!({
                "success": false,
                "error": "Element clicking via index not cached between CLI calls. Use direct input control instead."
            }));
        },
        Commands::Type { index, text: _ } => {
            println!("{}", json!({
                "success": false,
                "error": "Element typing via index not cached between CLI calls. Use direct input control instead."
            }));
        },
        Commands::PressKey { index, key: _ } => {
            println!("{}", json!({
                "success": false,
                "error": "Key pressing via index not cached between CLI calls. Use direct input control instead."
            }));
        },
        Commands::Input { action, data } => {
            match action.as_str() {
                "writetext" => {
                    let script = format!(r#"tell application "System Events" to keystroke "{}""#, data);
                    match Command::new("osascript").arg("-e").arg(&script).output() {
                        Ok(_) => {
                            println!("{}", json!({
                                "success": true,
                                "message": format!("Typed text: {}", data)
                            }));
                        },
                        Err(e) => {
                            println!("{}", json!({
                                "success": false,
                                "error": format!("Failed to type text: {}", e)
                            }));
                        }
                    }
                },
                "keypress" => {
                    let key_code = match data.as_str() {
                        "Return" | "Enter" => "36",
                        "Tab" => "48",
                        "Space" => "49",
                        "Escape" => "53",
                        _ => {
                            println!("{}", json!({
                                "success": false,
                                "error": format!("Unsupported key: {}", data)
                            }));
                            return Ok(());
                        }
                    };
                    
                    let script = format!(r#"tell application "System Events" to key code {}"#, key_code);
                    match Command::new("osascript").arg("-e").arg(&script).output() {
                        Ok(_) => {
                            println!("{}", json!({
                                "success": true,
                                "message": format!("Pressed key: {}", data)
                            }));
                        },
                        Err(e) => {
                            println!("{}", json!({
                                "success": false,
                                "error": format!("Failed to press key: {}", e)
                            }));
                        }
                    }
                },
                "click" => {
                    // Parse coordinates from data (format: "x,y")
                    if let Some((x_str, y_str)) = data.split_once(',') {
                        if let (Ok(x), Ok(y)) = (x_str.parse::<i32>(), y_str.parse::<i32>()) {
                            let script = format!(r#"tell application "System Events" to click at {{{}, {}}}"#, x, y);
                            match Command::new("osascript").arg("-e").arg(&script).output() {
                                Ok(_) => {
                                    println!("{}", json!({
                                        "success": true,
                                        "message": format!("Clicked at coordinates: {}, {}", x, y)
                                    }));
                                },
                                Err(e) => {
                                    println!("{}", json!({
                                        "success": false,
                                        "error": format!("Failed to click: {}", e)
                                    }));
                                }
                            }
                        } else {
                            println!("{}", json!({
                                "success": false,
                                "error": "Invalid coordinates format. Use 'x,y'"
                            }));
                        }
                    } else {
                        println!("{}", json!({
                            "success": false,
                            "error": "Coordinates required for click action. Use 'x,y' format"
                        }));
                    }
                },
                _ => {
                    println!("{}", json!({
                        "success": false,
                        "error": format!("Unknown input action: {}", action)
                    }));
                }
            }
        }
    }

    Ok(())
} 