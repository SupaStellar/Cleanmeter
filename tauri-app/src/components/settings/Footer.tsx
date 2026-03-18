import { Button, Caption1, Link, tokens } from "@fluentui/react-components";
import { useSettingsStore } from "@/stores/settings-store";
import { isBrowser } from "@/lib/tauri";

function openUrl(url: string) {
  if (isBrowser) {
    window.open(url, "_blank");
  } else {
    import("@tauri-apps/plugin-shell").then((m) => m.open(url));
  }
}

export function Footer() {
  const appVersion = useSettingsStore((s) => s.appVersion);

  return (
    <div className="flex flex-col gap-2" style={{ marginTop: 4 }}>
      <Button
        appearance="outline"
        onClick={() => openUrl("https://github.com/Danil0v3s/CleanMeter")}
        style={{ width: "100%" }}
      >
        Check the latest build
      </Button>

      <div className="flex gap-2">
        <Button
          appearance="outline"
          onClick={() => openUrl("https://discord.gg/phqwe89cvE")}
          style={{ flex: 1 }}
        >
          Discord
        </Button>
        <Button
          appearance="outline"
          onClick={() => openUrl("https://ko-fi.com/danil0v3s")}
          style={{ flex: 1 }}
        >
          Ko-fi
        </Button>
      </div>

      <div
        className="flex items-center justify-between"
        style={{ padding: "6px 0", color: tokens.colorNeutralForeground4 }}
      >
        <Caption1>v{appVersion}</Caption1>
        <div className="flex gap-2 items-center">
          <Link onClick={() => openUrl("https://github.com/Danil0v3s")} style={{ fontSize: 11 }}>
            Danil0v3s
          </Link>
          <Caption1>&middot;</Caption1>
          <Link onClick={() => openUrl("https://www.instagram.com/mars.designs")} style={{ fontSize: 11 }}>
            Mars
          </Link>
        </div>
      </div>
    </div>
  );
}
