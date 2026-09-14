use std::path::Path;
use tokio::io::AsyncReadExt;

const MAX_BYTES: u64 = 8 * 1024 * 1024;

fn attachment_mime(path: &Path) -> Result<&'static str, String> {
    match path.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).as_deref() {
        Some("png") => Ok("image/png"),
        Some("jpg" | "jpeg") => Ok("image/jpeg"),
        Some("webp") => Ok("image/webp"),
        Some("gif") => Ok("image/gif"),
        Some("log" | "txt") => Ok("text/plain"),
        _ => Err("Choose a PNG, JPG, WebP, GIF, .log or .txt file.".into()),
    }
}

fn validate(bytes: &[u8], mime: &str) -> Result<(), String> {
    if bytes.is_empty() { return Err("The attachment is empty.".into()); }
    if bytes.len() as u64 > MAX_BYTES { return Err("The attachment must be 8 MiB or smaller.".into()); }
    if mime == "text/plain" && (bytes.contains(&0) || std::str::from_utf8(bytes).is_err()) {
        return Err("Log attachments must be UTF-8 text (.log or .txt).".into());
    }
    Ok(())
}

pub async fn read(path: &Path) -> Result<(Vec<u8>, &'static str), String> {
    let mime = attachment_mime(path)?;
    let file = tokio::fs::File::open(path).await.map_err(|e| format!("Cannot open attachment: {e}"))?;
    let metadata = file.metadata().await.map_err(|e| format!("Cannot inspect attachment: {e}"))?;
    if !metadata.is_file() { return Err("Choose a regular file.".into()); }
    if metadata.len() > MAX_BYTES { return Err("The attachment must be 8 MiB or smaller.".into()); }
    // Bound the read too: a live log can grow after the metadata check.
    let mut bytes = Vec::new();
    file.take(MAX_BYTES + 1).read_to_end(&mut bytes).await.map_err(|e| format!("Cannot read attachment: {e}"))?;
    validate(&bytes, mime)?;
    Ok((bytes, mime))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logs_and_images_have_explicit_portal_mime_types() {
        assert_eq!(attachment_mime(Path::new("HardwareMonitor.LOG")).unwrap(), "text/plain");
        assert_eq!(attachment_mime(Path::new("cleanmeter.txt")).unwrap(), "text/plain");
        assert_eq!(attachment_mime(Path::new("screenshot.JPEG")).unwrap(), "image/jpeg");
        assert!(attachment_mime(Path::new("report.html")).is_err());
        assert!(attachment_mime(Path::new("report.exe")).is_err());
    }

    #[test]
    fn validates_text_and_size_without_rejecting_binary_images() {
        assert!(validate(b"[INFO] Starting monitor\r\n", "text/plain").is_ok());
        assert!(validate(&[0xff], "text/plain").is_err());
        assert!(validate(b"binary\0", "text/plain").is_err());
        assert!(validate(b"", "text/plain").is_err());
        assert!(validate(&vec![b'a'; MAX_BYTES as usize + 1], "text/plain").is_err());
        assert!(validate(&[0xff, 0], "image/jpeg").is_ok());
    }
}
