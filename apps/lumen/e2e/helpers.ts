import { expect, type Locator, type Page } from "@playwright/test";

export const attachConsoleGuards = (page: Page) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return {
    assertClean() {
      expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
      expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
    },
  };
};

export const parseFirstNumber = (value: string) => {
  const matched = value.match(/\d+/);
  return matched ? Number(matched[0]) : null;
};

export const getFooterStats = (page: Page) => page.locator(".doc-footer-stat");

export const getEditorLocators = (page: Page) => ({
  root: page.locator(".lumenpage-editor"),
  input: page.locator(".lumenpage-input"),
  scrollArea: page.locator(".lumenpage-scroll-area"),
});

export const focusEditor = async (page: Page) => {
  const { root, input } = getEditorLocators(page);
  await root.click({ position: { x: 430, y: 230 } });
  await input.focus();
};

export const openTableInsertDialog = async (page: Page) => {
  await page.locator(".menu-tab-trigger").nth(2).click();
  await page.locator(".toolbar .icon-btn").first().click();
  const dialog = page
    .locator(".t-dialog")
    .filter({ has: page.locator(".toolbar-input-dialog") });
  await expect(dialog).toBeVisible();
  return dialog;
};

export const insertTable = async (page: Page, value: string) => {
  const dialog = await openTableInsertDialog(page);
  await dialog.locator("input").first().fill(value);
  await dialog.locator("button").last().click();
};

export const scrollEditor = async (scrollArea: Locator, top: number) => {
  await scrollArea.evaluate((node, scrollTop) => {
    node.scrollTop = Math.min(node.scrollHeight, scrollTop);
  }, top);
};

type TablePixelProbe = {
  fragment: { x: number; y: number; width: number; height: number };
  samples: Record<string, number[]>;
};

export const probeTablePixels = async (page: Page) =>
  page.evaluate((): TablePixelProbe | null => {
    const app = document.querySelector("#app") as
      | (Element & {
          __vue_app__?: {
            _instance?: {
              setupState?: Record<string, unknown>;
            };
          };
        })
      | null;
    const view = app?.__vue_app__?._instance?.setupState?.view as
      | {
          _internals?: {
            renderer?: {
              pageCache?: Map<number, { canvas?: HTMLCanvasElement }>;
            };
            getLayout?: () => {
              pages?: Array<{
                fragments?: Array<{
                  type?: string;
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                }>;
              }>;
            };
          };
        }
      | undefined;
    const layout = view?._internals?.getLayout?.();
    const page0 = layout?.pages?.[0];
    const fragment = page0?.fragments?.find((item) => item?.type === "table");
    const entry = view?._internals?.renderer?.pageCache?.get(0);
    if (!fragment || !entry?.canvas) {
      return null;
    }
    const ctx = entry.canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    const points = {
      topBorder: [Math.floor(fragment.x + fragment.width / 2), Math.floor(fragment.y + 1)],
      leftBorder: [Math.floor(fragment.x + 1), Math.floor(fragment.y + fragment.height / 2)],
      rowDivider: [
        Math.floor(fragment.x + fragment.width / 2),
        Math.floor(fragment.y + fragment.height / 2),
      ],
      colDivider: [
        Math.floor(fragment.x + fragment.width / 2),
        Math.floor(fragment.y + fragment.height / 4),
      ],
    } satisfies Record<string, [number, number]>;
    const samples = Object.fromEntries(
      Object.entries(points).map(([key, [x, y]]) => [
        key,
        Array.from(ctx.getImageData(x, y, 1, 1).data),
      ]),
    );
    return {
      fragment: {
        x: fragment.x,
        y: fragment.y,
        width: fragment.width,
        height: fragment.height,
      },
      samples,
    };
  });

export const isNonWhitePixel = (pixel: number[]) =>
  pixel.length >= 3 && (pixel[0] < 245 || pixel[1] < 245 || pixel[2] < 245);
