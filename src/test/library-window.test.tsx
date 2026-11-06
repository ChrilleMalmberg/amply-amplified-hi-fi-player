import { cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryWindow } from "@/components/winamp/LibraryWindow";

vi.mock("@/components/winamp/player-context", () => ({
  usePlayer: () => ({ playItems: vi.fn(), appendItems: vi.fn() }),
}));

const library = {
  items: [],
  ready: true,
  progress: null,
  error: "",
  importFiles: vi.fn(async () => {}),
};
const view = () => <LibraryWindow library={library} onNewWindow={() => {}} />;

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Library layout loading", () => {
  it("renders on the server without browser storage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(renderToString(view())).toContain("Music library");
  });

  it("restores valid browser layout settings after mount", () => {
    localStorage.setItem("amply-library-cols", "[50,30,20]");
    localStorage.setItem("amply-library-groupw", "250");
    const { container } = render(view());
    expect(container.querySelector("col")?.style.width).toBe("50%");
    expect(
      container.querySelector<HTMLElement>(".wa-library-body")?.style.gridTemplateColumns,
    ).toBe("250px minmax(0, 1fr)");
  });

  it.each(["null", "{}", "[1]", '[48,"bad",12]', "[null,40,12]"])(
    "ignores invalid saved columns: %s",
    (value) => {
      localStorage.setItem("amply-library-cols", value);
      localStorage.setItem("amply-library-groupw", "Infinity");
      const { container } = render(view());
      expect(container.querySelector("col")?.style.width).toBe("48%");
      expect(
        container.querySelector<HTMLElement>(".wa-library-body")?.style.gridTemplateColumns,
      ).toBe("175px minmax(0, 1fr)");
    },
  );
});
