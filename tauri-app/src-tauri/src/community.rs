use serde_json::Value;
use std::time::Duration;

// Restrict this bridge to the configured service. No caller-supplied URLs,
// credentials or redirects; importing a preset cannot initiate a network call.
#[tauri::command]
pub async fn community_presets(action: String, id: Option<String>, page: Option<u32>, preset: Option<Value>) -> Result<Value, String> {
    let base = option_env!("FEEDBACK_PORTAL_URL").filter(|s| !s.trim().is_empty())
        .ok_or("The community gallery is not configured in this build. Local presets still work.")?;
    let mut url = reqwest::Url::parse(base.trim()).map_err(|_| "Invalid community service configuration")?;
    if url.scheme() != "https" { return Err("The community service requires HTTPS".into()); }
    let client = reqwest::Client::builder().timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none()).build().map_err(|e| e.to_string())?;
    let request = match action.as_str() {
        "list" => { url.set_path("/api/presets"); url.set_query(Some(&format!("page={}", page.unwrap_or(0).min(10000)))); client.get(url) }
        "get" => {
            let id = id.ok_or("Missing preset ID")?;
            if id.len() != 36 || !id.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-') { return Err("Invalid preset ID".into()); }
            url.set_path(&format!("/api/presets/{id}")); url.set_query(None); client.get(url)
        }
        "submit" => {
            let body = serde_json::to_string(&preset.ok_or("Missing preset")?).map_err(|e| e.to_string())?;
            if body.len() > 200_000 { return Err("Preset exceeds 200 KB".into()); }
            url.set_path("/api/presets"); url.set_query(None);
            client.post(url).header("content-type", "application/json").body(body)
        }
        _ => return Err("Unknown community action".into()),
    };
    let mut response = request.send().await.map_err(|_| "Could not reach the community gallery. Try again later.")?;
    let status = response.status();
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Could not read the community response")? {
        if bytes.len() + chunk.len() > 250_000 { return Err("Community response was too large".into()); }
        bytes.extend_from_slice(&chunk);
    }
    if !status.is_success() {
        return Err(match status.as_u16() {
            429 => "Too many submissions. Please wait a few minutes.",
            404 => "This preset is no longer available, or the gallery has not been deployed yet.",
            _ => "The community gallery could not complete this request.",
        }.into());
    }
    serde_json::from_slice(&bytes).map_err(|_| "Invalid community response".into())
}
