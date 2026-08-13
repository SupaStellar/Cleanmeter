import { describe, expect, it } from "vitest";
import { AUTO_OPTION, monitorAppOptions } from "./fps-apps";

describe("monitorAppOptions", () => {
  it("selects Auto when nothing is picked", () => {
    expect(monitorAppOptions({ apps: ["Game.exe"], target: "" })).toEqual({
      value: AUTO_OPTION,
      options: ["Game.exe"],
    });
  });

  // The bug this exists to prevent. The section was rendered only when the
  // list had entries, so at the desktop, or after alt-tabbing out of a
  // fullscreen game, the whole control vanished. Auto has to stay reachable
  // with an empty list, which means the caller always renders it and this
  // function always returns a usable value.
  it("still offers Auto when no app is presenting", () => {
    expect(monitorAppOptions({ apps: [], target: "" })).toEqual({
      value: AUTO_OPTION,
      options: [],
    });
  });

  it("keeps a picked app selectable while it is not running", () => {
    expect(monitorAppOptions({ apps: [], target: "Game.exe" })).toEqual({
      value: "Game.exe",
      options: ["Game.exe"],
    });
  });

  it("does not list a picked app twice once it starts presenting", () => {
    expect(monitorAppOptions({ apps: ["Game.exe", "Other.exe"], target: "Game.exe" })).toEqual({
      value: "Game.exe",
      options: ["Game.exe", "Other.exe"],
    });
  });

  // PresentMon reports the exe's filesystem casing and the stored pick may
  // differ, while Radix matches option values by exact string. Returning the
  // stored spelling here would match no option and blank the trigger.
  it("follows the live spelling when the pick differs only by case", () => {
    expect(monitorAppOptions({ apps: ["Game.exe"], target: "GAME.EXE" })).toEqual({
      value: "Game.exe",
      options: ["Game.exe"],
    });
  });
});
