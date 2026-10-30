//! Translate the shared W3C/global-hotkey key names to XDG shortcut keysyms.
pub fn trigger(accelerator: &str) -> String {
    accelerator.split('+').map(|key| {
        match key {
            "Ctrl" | "Control" => "CTRL", "Alt" => "ALT", "Shift" => "SHIFT",
            "Super" | "Meta" | "Cmd" | "Command" => "LOGO",
            "Enter" => "Return", "Space" => "space", "Backspace" => "BackSpace",
            "CapsLock" => "Caps_Lock", "NumLock" => "Num_Lock", "ScrollLock" => "Scroll_Lock",
            "PrintScreen" => "Print", "PageUp" => "Prior", "PageDown" => "Next",
            "ArrowUp" => "Up", "ArrowDown" => "Down", "ArrowLeft" => "Left", "ArrowRight" => "Right",
            "Backquote" => "grave", "Backslash" => "backslash", "BracketLeft" => "bracketleft",
            "BracketRight" => "bracketright", "Comma" => "comma", "Equal" => "equal",
            "Minus" => "minus", "Period" => "period", "Quote" => "apostrophe",
            "Semicolon" => "semicolon", "Slash" => "slash", "NumpadAdd" => "KP_Add",
            "NumpadDecimal" => "KP_Decimal", "NumpadDivide" => "KP_Divide", "NumpadEnter" => "KP_Enter",
            "NumpadEqual" => "KP_Equal", "NumpadMultiply" => "KP_Multiply", "NumpadSubtract" => "KP_Subtract",
            other => {
                if let Some(letter) = other.strip_prefix("Key") { return letter.to_lowercase(); }
                if let Some(digit) = other.strip_prefix("Digit") { return digit.to_owned(); }
                if let Some(digit) = other.strip_prefix("Numpad") { return format!("KP_{digit}"); }
                other
            }
        }.to_owned()
    }).collect::<Vec<_>>().join("+")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn translates_modifiers_letters_punctuation_navigation_and_numpad() {
        for (input, expected) in [("Ctrl+Alt+F10", "CTRL+ALT+F10"), ("Super+KeyA", "LOGO+a"),
            ("Shift+Digit1", "SHIFT+1"), ("Alt+ArrowUp", "ALT+Up"), ("Ctrl+Numpad7", "CTRL+KP_7"),
            ("Ctrl+Semicolon", "CTRL+semicolon"), ("Alt+Enter", "ALT+Return"), ("", "")] {
            assert_eq!(trigger(input), expected);
        }
    }
}
