import {
  DocumentLockMark,
  findDocumentLockRanges,
  findDocumentLockRangesAtPos,
  getDocumentLockMarksAtPos,
  isDocumentLockNode,
  isDocumentLockableNode,
  isPositionInsideDocumentLock,
  rangeTouchesDocumentLock,
} from "./documentLockMark.js";
import {
  DocumentLockPluginKey,
  createDocumentLockPlugin,
  getDocumentLockPluginState,
} from "./documentLockPlugin.js";
import { DocumentLock, DocumentLockRuntime } from "./documentLockRuntime.js";

export {
  DOCUMENT_LOCK_META,
  DOCUMENT_LOCK_NODE_ATTR,
  DOCUMENT_LOCK_NODE_TYPES,
  createDefaultDocumentLockOptions,
  markDocumentLockTransaction,
} from "./types.js";
export type {
  DocumentLockMeta,
  DocumentLockOptions,
  DocumentLockPluginState,
  DocumentLockRange,
  DocumentLockRangeKind,
} from "./types.js";
export {
  DocumentLock,
  DocumentLockMark,
  DocumentLockPluginKey,
  DocumentLockRuntime,
  createDocumentLockPlugin,
  findDocumentLockRanges,
  findDocumentLockRangesAtPos,
  getDocumentLockMarksAtPos,
  getDocumentLockPluginState,
  isDocumentLockNode,
  isDocumentLockableNode,
  isPositionInsideDocumentLock,
  rangeTouchesDocumentLock,
};

export default DocumentLock;
