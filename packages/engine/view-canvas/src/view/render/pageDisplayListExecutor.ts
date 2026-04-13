import {
  type RendererPageDisplayListContext,
  type RendererPageDisplayList,
  type RendererPageDisplayListItem,
} from "./pageDisplayList.js";
import { renderPageLineCompatPass } from "./pageLineCompatPass.js";
import { renderPageFragmentPass } from "./pageFragmentPass.js";
import { renderPageShell } from "./pageDisplayListItems.js";

export const executeRendererPageDisplayListItem = ({
  ctx,
  item,
  context,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  item: RendererPageDisplayListItem;
  context: RendererPageDisplayListContext;
}) => {
  switch (item.kind) {
    case "page-shell":
      renderPageShell({
        ctx,
        width: context.width,
        height: context.height,
        pageIndex: context.pageIndex,
        layout: context.layout,
        settings: context.settings,
      });
      return;
    case "fragment-pass":
      renderPageFragmentPass({
        ctx,
        layout: context.layout,
        registry: context.registry,
        defaultRender: context.createDefaultRender(ctx),
        fragmentPass: item.pass,
        runtime: context.runtime,
      });
      return;
    case "line-compat-pass":
      renderPageLineCompatPass({
        ctx,
        layout: context.layout,
        registry: context.registry,
        defaultRender: context.createDefaultRender(ctx),
        compatPass: item.pass,
        runtime: context.runtime,
      });
      return;
  }
};

export const executeRendererPageDisplayList = ({
  ctx,
  displayList,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  displayList: RendererPageDisplayList;
}) => {
  for (const item of displayList.items) {
    executeRendererPageDisplayListItem({
      ctx,
      item,
      context: displayList.context,
    });
  }
};
