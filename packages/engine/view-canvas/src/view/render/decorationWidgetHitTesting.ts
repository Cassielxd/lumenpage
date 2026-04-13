import { type DecorationWidget } from "./decorations.js";

const resolveWidgetHitHeight = (widget: DecorationWidget) =>
  Math.max(
    0,
    Number(widget?.height) || 0,
    Number(widget?.width) || 0,
    Number(widget?.decoration?.spec?.widgetWidth) || 0
  );

export const hitTestDecorationWidgetAtCoords = ({
  widgets,
  coords,
}: {
  widgets: DecorationWidget[] | null | undefined;
  coords: { x: number; y: number } | null | undefined;
}) => {
  if (!Array.isArray(widgets) || widgets.length === 0 || !coords) {
    return null;
  }

  const x = Number(coords.x);
  const y = Number(coords.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  for (let index = widgets.length - 1; index >= 0; index -= 1) {
    const widget = widgets[index];
    const widgetX = Number(widget?.x);
    const widgetY = Number(widget?.y);
    const widgetWidth = Math.max(0, Number(widget?.width) || 0);
    const widgetHeight = resolveWidgetHitHeight(widget);
    if (
      !Number.isFinite(widgetX) ||
      !Number.isFinite(widgetY) ||
      widgetWidth <= 0 ||
      widgetHeight <= 0
    ) {
      continue;
    }
    if (x < widgetX || x > widgetX + widgetWidth || y < widgetY || y > widgetY + widgetHeight) {
      continue;
    }

    return {
      widget,
      x: widgetX,
      y: widgetY,
      width: widgetWidth,
      height: widgetHeight,
    };
  }

  return null;
};

export const handleDecorationWidgetClick = ({
  view,
  event,
  coords,
  widgets,
}: {
  view: any;
  event: any;
  coords: { x: number; y: number } | null | undefined;
  widgets: DecorationWidget[] | null | undefined;
}) => {
  const hit = hitTestDecorationWidgetAtCoords({ widgets, coords });
  const onClick = hit?.widget?.decoration?.spec?.onClick;
  if (!hit || typeof onClick !== "function") {
    return false;
  }

  return (
    onClick({
      view,
      event,
      decoration: hit.widget.decoration,
      x: hit.x,
      y: hit.y,
      width: hit.width,
      height: hit.height,
    }) === true
  );
};
