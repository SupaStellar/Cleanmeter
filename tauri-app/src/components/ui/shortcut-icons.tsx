import { useId } from "react";
// Inline SVG icons for the shortcut fields and the toast, exported verbatim
// from Figma via the
// Desktop Bridge (exportAsync SVG_STRING) rather than redrawn. Node ids are on
// each icon. The mask each one carries is Figma's own 20x20/16x16 bounding box
// — kept so the path keeps the inset it was drawn with.
//
// `fill="currentColor"` replaces the exported literal #61646C so a caller can
// tint them; #61646C is Icon/Bolder Active (--iconBolderActive), which is what
// every one of these resolves to in the frame.
type IconProps = { className?: string };

/**
 * Filled exclamation circle — Figma 2819:9777, inside the `error` group
 * 2819:9778. The glyph in the hotkey-conflict toast.
 *
 * The VECTOR alone exports at 17x17 with no inset; the GROUP exports at 20x20
 * with the path sitting 1.67 in on each side, which is the size and the
 * padding the frame actually draws. This is the group export, so the icon
 * lines up with the 20x20 `delete` and `forward_media` next to it instead of
 * reading a size larger.
 *
 * Its exported fill was #FDB022, which is Bg/Warning Active — swapped for
 * `currentColor` here and re-applied by the caller through the token, so the
 * icon follows the theme rather than pinning one mode's hex.
 */
export function ErrorIcon({ className }: IconProps) {
  // useId, not a literal: the Shortcuts card renders two ShortcutFields at
  // once, so a hardcoded id appears twice in one document. Duplicate ids are
  // invalid and url(#id) resolves document-wide to the first match.
  const maskId = useId();
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden
    >
      <mask
        id={maskId}
        style={{ maskType: "alpha" }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="20"
        height="20"
      >
        <rect width="20" height="20" fill="#D9D9D9" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path
          d="M10.5931 13.9284C10.7528 13.7687 10.8327 13.5707 10.8327 13.3346C10.8327 13.0985 10.7528 12.9006 10.5931 12.7409C10.4334 12.5812 10.2355 12.5013 9.99935 12.5013C9.76324 12.5013 9.56532 12.5812 9.4056 12.7409C9.24588 12.9006 9.16602 13.0985 9.16602 13.3346C9.16602 13.5707 9.24588 13.7687 9.4056 13.9284C9.56532 14.0881 9.76324 14.168 9.99935 14.168C10.2355 14.168 10.4334 14.0881 10.5931 13.9284ZM10.5931 10.5951C10.7528 10.4353 10.8327 10.2374 10.8327 10.0013V6.66797C10.8327 6.43186 10.7528 6.23394 10.5931 6.07422C10.4334 5.9145 10.2355 5.83464 9.99935 5.83464C9.76324 5.83464 9.56532 5.9145 9.4056 6.07422C9.24588 6.23394 9.16602 6.43186 9.16602 6.66797V10.0013C9.16602 10.2374 9.24588 10.4353 9.4056 10.5951C9.56532 10.7548 9.76324 10.8346 9.99935 10.8346C10.2355 10.8346 10.4334 10.7548 10.5931 10.5951ZM9.99935 18.3346C8.84657 18.3346 7.76324 18.1159 6.74935 17.6784C5.73546 17.2409 4.85352 16.6471 4.10352 15.8971C3.35352 15.1471 2.75977 14.2652 2.32227 13.2513C1.88477 12.2374 1.66602 11.1541 1.66602 10.0013C1.66602 8.84852 1.88477 7.76519 2.32227 6.7513C2.75977 5.73741 3.35352 4.85547 4.10352 4.10547C4.85352 3.35547 5.73546 2.76172 6.74935 2.32422C7.76324 1.88672 8.84657 1.66797 9.99935 1.66797C11.1521 1.66797 12.2355 1.88672 13.2493 2.32422C14.2632 2.76172 15.1452 3.35547 15.8952 4.10547C16.6452 4.85547 17.2389 5.73741 17.6764 6.7513C18.1139 7.76519 18.3327 8.84852 18.3327 10.0013C18.3327 11.1541 18.1139 12.2374 17.6764 13.2513C17.2389 14.2652 16.6452 15.1471 15.8952 15.8971C15.1452 16.6471 14.2632 17.2409 13.2493 17.6784C12.2355 18.1159 11.1521 18.3346 9.99935 18.3346ZM9.99935 16.668C11.8605 16.668 13.4368 16.0221 14.7285 14.7305C16.0202 13.4388 16.666 11.8624 16.666 10.0013C16.666 8.14019 16.0202 6.5638 14.7285 5.27214C13.4368 3.98047 11.8605 3.33464 9.99935 3.33464C8.13824 3.33464 6.56185 3.98047 5.27018 5.27214C3.97852 6.5638 3.33268 8.14019 3.33268 10.0013C3.33268 11.8624 3.97852 13.4388 5.27018 14.7305C6.56185 16.0221 8.13824 16.668 9.99935 16.668Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

/**
 * Trash — Figma 2792:4178. Clears a bound shortcut.
 *
 * Paired with RestoreIcon below: the frame shows `delete` on a row that has a
 * shortcut (2792:4089) and `forward_media` on one that does not (2792:4299),
 * so the two are the two halves of one control — clear what is set, put back
 * what is not.
 */
export function DeleteIcon({ className }: IconProps) {
  // useId, not a literal: the Shortcuts card renders two ShortcutFields at
  // once, so a hardcoded id appears twice in one document. Duplicate ids are
  // invalid and url(#id) resolves document-wide to the first match.
  const maskId = useId();
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden
    >
      <mask
        id={maskId}
        style={{ maskType: "alpha" }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="20"
        height="20"
      >
        <rect width="20" height="20" fill="#D9D9D9" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path
          d="M5.83325 17.5C5.37492 17.5 4.98256 17.3368 4.65617 17.0104C4.32978 16.684 4.16659 16.2917 4.16659 15.8333V5C3.93047 5 3.73256 4.92014 3.57284 4.76042C3.41311 4.60069 3.33325 4.40278 3.33325 4.16667C3.33325 3.93056 3.41311 3.73264 3.57284 3.57292C3.73256 3.41319 3.93047 3.33333 4.16659 3.33333H7.49992C7.49992 3.09722 7.57978 2.89931 7.7395 2.73958C7.89922 2.57986 8.09714 2.5 8.33325 2.5H11.6666C11.9027 2.5 12.1006 2.57986 12.2603 2.73958C12.4201 2.89931 12.4999 3.09722 12.4999 3.33333H15.8333C16.0694 3.33333 16.2673 3.41319 16.427 3.57292C16.5867 3.73264 16.6666 3.93056 16.6666 4.16667C16.6666 4.40278 16.5867 4.60069 16.427 4.76042C16.2673 4.92014 16.0694 5 15.8333 5V15.8333C15.8333 16.2917 15.6701 16.684 15.3437 17.0104C15.0173 17.3368 14.6249 17.5 14.1666 17.5H5.83325ZM14.1666 5H5.83325V15.8333H14.1666V5ZM8.927 13.9271C9.08672 13.7674 9.16658 13.5694 9.16658 13.3333V7.5C9.16658 7.26389 9.08672 7.06597 8.927 6.90625C8.76728 6.74653 8.56936 6.66667 8.33325 6.66667C8.09714 6.66667 7.89922 6.74653 7.7395 6.90625C7.57978 7.06597 7.49992 7.26389 7.49992 7.5V13.3333C7.49992 13.5694 7.57978 13.7674 7.7395 13.9271C7.89922 14.0868 8.09714 14.1667 8.33325 14.1667C8.56936 14.1667 8.76728 14.0868 8.927 13.9271ZM12.2603 13.9271C12.4201 13.7674 12.4999 13.5694 12.4999 13.3333V7.5C12.4999 7.26389 12.4201 7.06597 12.2603 6.90625C12.1006 6.74653 11.9027 6.66667 11.6666 6.66667C11.4305 6.66667 11.2326 6.74653 11.0728 6.90625C10.9131 7.06597 10.8333 7.26389 10.8333 7.5V13.3333C10.8333 13.5694 10.9131 13.7674 11.0728 13.9271C11.2326 14.0868 11.4305 14.1667 11.6666 14.1667C11.9027 14.1667 12.1006 14.0868 12.2603 13.9271Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

/**
 * Counter-clockwise arrow — Figma 2792:4585, named `forward_media` there.
 * Restores the shortcut to its shipped default.
 *
 * The export mirrors the *mask* (`matrix(-1 0 0 1 20 0)`), not the path: the
 * mask is a full-bleed rect, so the flip changes nothing and the path is
 * already the anticlockwise arrow. Kept as exported rather than "simplified"
 * so a re-export diffs clean against this file.
 */
export function RestoreIcon({ className }: IconProps) {
  // useId, not a literal: the Shortcuts card renders two ShortcutFields at
  // once, so a hardcoded id appears twice in one document. Duplicate ids are
  // invalid and url(#id) resolves document-wide to the first match.
  const maskId = useId();
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden
    >
      <mask
        id={maskId}
        style={{ maskType: "alpha" }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="20"
        height="20"
      >
        <rect
          width="20"
          height="20"
          transform="matrix(-1 0 0 1 20 0)"
          fill="#D9D9D9"
        />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path
          d="M10 18.3351C11.0417 18.3351 12.0174 18.1371 12.9271 17.7413C13.8368 17.3455 14.6285 16.8107 15.3021 16.1371C15.9757 15.4635 16.5104 14.6719 16.9062 13.7621C17.3021 12.8524 17.5 11.8767 17.5 10.8351C17.5 9.79339 17.3021 8.81769 16.9062 7.90797C16.5104 6.99825 15.9757 6.20658 15.3021 5.53297C14.6285 4.85936 13.8368 4.32464 12.9271 3.9288C12.0174 3.53297 11.0417 3.33505 10 3.33505H9.875L10.5833 2.62672C10.7361 2.47394 10.8125 2.28297 10.8125 2.0538C10.8125 1.82464 10.7361 1.62672 10.5833 1.46005C10.4167 1.29339 10.2187 1.20658 9.98958 1.19964C9.76042 1.19269 9.5625 1.27255 9.39583 1.43922L7.25 3.58505C7.09722 3.73783 7.02083 3.93227 7.02083 4.16839C7.02083 4.4045 7.09722 4.59894 7.25 4.75172L9.39583 6.89755C9.5625 7.06422 9.76042 7.14408 9.98958 7.13714C10.2187 7.13019 10.4167 7.04339 10.5833 6.87672C10.7361 6.71005 10.8125 6.51214 10.8125 6.28297C10.8125 6.0538 10.7361 5.86283 10.5833 5.71005L9.875 5.00172H10C11.625 5.00172 13.0035 5.56769 14.1354 6.69964C15.2674 7.83158 15.8333 9.21005 15.8333 10.8351C15.8333 12.4601 15.2674 13.8385 14.1354 14.9705C13.0035 16.1024 11.625 16.6684 10 16.6684C8.52778 16.6684 7.24305 16.1892 6.14583 15.2309C5.04861 14.2726 4.40278 13.0642 4.20833 11.6059C4.18055 11.3837 4.08333 11.1996 3.91667 11.0538C3.75 10.908 3.55555 10.8351 3.33333 10.8351C3.11111 10.8351 2.91667 10.9045 2.75 11.0434C2.58333 11.1823 2.51389 11.3559 2.54167 11.5642C2.73611 13.4948 3.54167 15.1059 4.95833 16.3976C6.375 17.6892 8.05555 18.3351 10 18.3351Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
