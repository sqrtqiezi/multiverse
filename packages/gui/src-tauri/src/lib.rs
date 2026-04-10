use serde_json::Value;
use std::sync::Arc;
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

struct Sidecar {
    stdin: tokio::process::ChildStdin,
    pending: Arc<Mutex<std::collections::HashMap<u64, tokio::sync::oneshot::Sender<Value>>>>,
}

struct AppState {
    sidecar: Mutex<Option<Sidecar>>,
    next_id: Mutex<u64>,
}

async fn start_sidecar(gui_server_path: &str) -> Result<(Child, Sidecar), String> {
    let mut child = Command::new("node")
        .arg(gui_server_path)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start gui-server: {}", e))?;

    let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;

    let pending: Arc<Mutex<std::collections::HashMap<u64, tokio::sync::oneshot::Sender<Value>>>> =
        Arc::new(Mutex::new(std::collections::HashMap::new()));

    let pending_clone = pending.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if let Ok(response) = serde_json::from_str::<Value>(&line) {
                if let Some(id) = response.get("id").and_then(|v| v.as_u64()) {
                    let mut map = pending_clone.lock().await;
                    if let Some(sender) = map.remove(&id) {
                        let _ = sender.send(response);
                    }
                }
            }
        }
    });

    Ok((child, Sidecar { stdin, pending }))
}

#[tauri::command]
async fn rpc_call(
    state: tauri::State<'_, AppState>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    let mut sidecar_guard = state.sidecar.lock().await;
    let sidecar = sidecar_guard
        .as_mut()
        .ok_or("Sidecar not started")?;

    let mut id_guard = state.next_id.lock().await;
    let id = *id_guard;
    *id_guard += 1;
    drop(id_guard);

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params,
    });

    let (tx, rx) = tokio::sync::oneshot::channel();
    sidecar.pending.lock().await.insert(id, tx);

    let mut request_str = serde_json::to_string(&request)
        .map_err(|e| format!("Failed to serialize request: {}", e))?;
    request_str.push('\n');

    sidecar
        .stdin
        .write_all(request_str.as_bytes())
        .await
        .map_err(|e| format!("Failed to write to sidecar: {}", e))?;

    sidecar
        .stdin
        .flush()
        .await
        .map_err(|e| format!("Failed to flush sidecar stdin: {}", e))?;

    let response = rx
        .await
        .map_err(|_| "Sidecar response channel closed")?;

    if let Some(error) = response.get("error") {
        return Err(format!("RPC error: {}", error));
    }

    Ok(response.get("result").cloned().unwrap_or(Value::Null))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let gui_server_path = std::env::var("MULTIVERSE_GUI_SERVER_PATH")
                .unwrap_or_else(|_| {
                    let exe_dir = std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|p| p.to_path_buf()));
                    if let Some(dir) = exe_dir {
                        dir.join("../../packages/gui-server/dist/index.js")
                            .to_string_lossy()
                            .to_string()
                    } else {
                        "packages/gui-server/dist/index.js".to_string()
                    }
                });

            let state = AppState {
                sidecar: Mutex::new(None),
                next_id: Mutex::new(1),
            };

            app.manage(state);

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<AppState>();
                match start_sidecar(&gui_server_path).await {
                    Ok((_child, sidecar)) => {
                        *state.sidecar.lock().await = Some(sidecar);
                        eprintln!("gui-server sidecar started");
                    }
                    Err(e) => {
                        eprintln!("Failed to start gui-server sidecar: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![rpc_call])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
