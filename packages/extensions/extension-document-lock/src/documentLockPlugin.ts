import { ChangeSet, simplifyChanges } from "lumenpage-extension-changeset";
import { Plugin, PluginKey } from "lumenpage-state";
import { Decoration, DecorationSet } from "lumenpage-view-canvas";

import {
  findDocumentLockRanges,
  isPositionInsideDocumentLock,
  rangeTouchesDocumentLock,
} from "./documentLockMark.js";
import {
  DOCUMENT_LOCK_META,
  createDefaultDocumentLockOptions,
  type DocumentLockOptions,
  type DocumentLockPluginState,
} from "./types.js";

const createDefaultPluginState = (
  options: Pick<DocumentLockOptions, "enabled" | "showMarkers">
): DocumentLockPluginState => ({
  enabled: options.enabled === true,
  showMarkers: options.showMarkers === true,
  revision: 0,
});

export const DocumentLockPluginKey = new PluginKey<DocumentLockPluginState>("documentLock");

const drawLockMarker = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number | undefined,
  options: DocumentLockOptions
) => {
  const size = Math.max(10, Number(options.markerSize) || 14);
  const bodyWidth = Math.max(6, size * 0.58);
  const bodyHeight = Math.max(5, size * 0.46);
  const bodyX = x + 3;
  const boxY = y + Math.max(0, ((Number.isFinite(height) ? Number(height) : size) - size) / 2) + 1;
  const bodyY = boxY + size * 0.38;
  const shackleRadius = bodyWidth * 0.38;
  const shackleCenterX = bodyX + bodyWidth / 2;
  const shackleCenterY = bodyY + 1;

  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = options.markerColor;
  ctx.fillStyle = options.markerFillColor;

  ctx.beginPath();
  ctx.arc(shackleCenterX, shackleCenterY, shackleRadius, Math.PI, 0, false);
  ctx.stroke();

  const bodyRadius = 2;
  ctx.beginPath();
  ctx.moveTo(bodyX + bodyRadius, bodyY);
  ctx.lineTo(bodyX + bodyWidth - bodyRadius, bodyY);
  ctx.quadraticCurveTo(bodyX + bodyWidth, bodyY, bodyX + bodyWidth, bodyY + bodyRadius);
  ctx.lineTo(bodyX + bodyWidth, bodyY + bodyHeight - bodyRadius);
  ctx.quadraticCurveTo(
    bodyX + bodyWidth,
    bodyY + bodyHeight,
    bodyX + bodyWidth - bodyRadius,
    bodyY + bodyHeight
  );
  ctx.lineTo(bodyX + bodyRadius, bodyY + bodyHeight);
  ctx.quadraticCurveTo(bodyX, bodyY + bodyHeight, bodyX, bodyY + bodyHeight - bodyRadius);
  ctx.lineTo(bodyX, bodyY + bodyRadius);
  ctx.quadraticCurveTo(bodyX, bodyY, bodyX + bodyRadius, bodyY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(bodyX + bodyWidth / 2, bodyY + bodyHeight * 0.45, 1.2, 0, Math.PI * 2, false);
  ctx.fillStyle = options.markerColor;
  ctx.fill();
  ctx.restore();
};

const createDocumentLockDecorations = (
  state: any,
  pluginState: DocumentLockPluginState,
  options: DocumentLockOptions
) => {
  if (pluginState?.showMarkers !== true) {
    return null;
  }

  const ranges = findDocumentLockRanges(state);
  if (ranges.length === 0) {
    return null;
  }

  const decorations = ranges.flatMap((range) => {
    const widgets = [
      Decoration.widget(
        range.to,
        (ctx, x, y, height) => drawLockMarker(ctx, x, y, height, options),
        {
          side: 1,
          widgetAlignment: "page-right",
          widgetWidth: Math.max(10, Number(options.markerSize) || 14),
          widgetRightInset: 8,
        }
      ),
    ];

    if (range.kind !== "node") {
      return widgets;
    }

    return [
      Decoration.node(range.from, range.to, {
        backgroundColor: options.lockedBackgroundColor,
      }),
      ...widgets,
    ];
  });

  return DecorationSet.create(state.doc, decorations);
};

const transactionViolatesDocumentLock = (state: any, transaction: any) => {
  const oldDoc = state?.doc;
  const newDoc = transaction?.doc;
  if (!oldDoc || !newDoc || !transaction?.mapping?.maps) {
    return false;
  }

  const changeSet = ChangeSet.create(oldDoc).addSteps(newDoc, transaction.mapping.maps, 0);
  const changes = simplifyChanges(changeSet.changes, newDoc).filter((change) => {
    return change.toA > change.fromA || change.toB > change.fromB;
  });

  return changes.some((change) => {
    if (change.toA > change.fromA && rangeTouchesDocumentLock(state, change.fromA, change.toA)) {
      return true;
    }
    if (change.toA === change.fromA && change.toB > change.fromB) {
      return isPositionInsideDocumentLock(state, change.fromA);
    }
    return false;
  });
};

export const getDocumentLockPluginState = (state: any): DocumentLockPluginState =>
  DocumentLockPluginKey.getState(state) ||
  createDefaultPluginState(createDefaultDocumentLockOptions());

export const createDocumentLockPlugin = (pluginOptions: Partial<DocumentLockOptions> = {}) => {
  const options = {
    ...createDefaultDocumentLockOptions(),
    ...(pluginOptions || {}),
  };

  return new Plugin<DocumentLockPluginState>({
    key: DocumentLockPluginKey,
    state: {
      init: () => createDefaultPluginState(options),
      apply: (
        transaction: any,
        pluginState: DocumentLockPluginState,
        _oldState: any,
        newState: any
      ) => {
        const meta = transaction?.getMeta?.(DOCUMENT_LOCK_META) || null;
        let enabled = pluginState?.enabled === true;
        let showMarkers = pluginState?.showMarkers === true;
        let changed = false;

        if (meta && typeof meta.enabled === "boolean" && meta.enabled !== enabled) {
          enabled = meta.enabled;
          changed = true;
        }
        if (meta && typeof meta.showMarkers === "boolean" && meta.showMarkers !== showMarkers) {
          showMarkers = meta.showMarkers;
          changed = true;
        }

        const shouldRefresh = transaction?.docChanged === true || meta?.refresh === true;
        if (!changed && !shouldRefresh) {
          return pluginState;
        }

        return {
          enabled,
          showMarkers,
          revision: Number(pluginState?.revision || 0) + 1,
        };
      },
    },
    filterTransaction(transaction: any, state: any) {
      if (!transaction || transaction.docChanged !== true) {
        return true;
      }

      const meta = transaction.getMeta?.(DOCUMENT_LOCK_META) || null;
      if (meta?.skipEnforcement === true) {
        return true;
      }

      if (getDocumentLockPluginState(state).enabled !== true) {
        return true;
      }

      return !transactionViolatesDocumentLock(state, transaction);
    },
    props: {
      decorations(state: any) {
        return createDocumentLockDecorations(
          state,
          getDocumentLockPluginState(state),
          options
        );
      },
    },
  });
};
