import { Fragment } from "lumenpage-model";
import type { Schema } from "lumenpage-model";
import { AllSelection, NodeSelection, Selection, TextSelection } from "lumenpage-state";
import * as Y from "yjs";

const HASHED_MARK_NAME_REGEX = /(.*)(--[a-zA-Z0-9]+)$/;

export type LumenYjsMapping = Map<any, any>;

export type LumenYjsBindingMeta = {
  mapping: LumenYjsMapping;
  overlappingMarks: Map<any, boolean>;
};

export type LumenRelativeSelection = {
  type: "all" | "node" | "text";
  anchor: any | null;
  head: any | null;
};

export const createBindingMeta = (mapping: LumenYjsMapping = new Map()): LumenYjsBindingMeta => ({
  mapping,
  overlappingMarks: new Map(),
});

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
};

export const yattr2markname = (attrName: string) =>
  HASHED_MARK_NAME_REGEX.exec(attrName)?.[1] ?? attrName;

const attributesToMarks = (attrs: Record<string, any> | null | undefined, schema: Schema) => {
  const marks: any[] = [];

  for (const [attrName, markAttrs] of Object.entries(attrs || {})) {
    const markType = schema.marks[yattr2markname(attrName)];
    if (!markType) {
      continue;
    }
    marks.push(markType.create(markAttrs ?? undefined));
  }

  return marks;
};

const marksToAttributes = (marks: readonly any[], meta: LumenYjsBindingMeta) => {
  const attributes: Record<string, any> = {};

  for (const mark of marks || []) {
    if (!mark?.type?.name) {
      continue;
    }

    const overlapsSelf = !mark.type.excludes(mark.type);
    meta.overlappingMarks.set(mark.type, overlapsSelf);

    const attrName = overlapsSelf
      ? `${mark.type.name}--${stableHash(JSON.stringify(mark.toJSON()))}`
      : mark.type.name;

    attributes[attrName] = mark.attrs || {};
  }

  return attributes;
};

const createTextNodesFromYText = (text: Y.XmlText, schema: Schema, meta: LumenYjsBindingMeta) => {
  const nodes: any[] = [];

  for (const delta of text.toDelta()) {
    if (typeof delta?.insert !== "string" || delta.insert.length === 0) {
      continue;
    }
    nodes.push(schema.text(delta.insert, attributesToMarks(delta.attributes, schema)));
  }

  meta.mapping.set(text, nodes);
  return nodes;
};

const createNodeFromYElement = (element: Y.XmlElement, schema: Schema, meta: LumenYjsBindingMeta) => {
  const children: any[] = [];

  for (const child of element.toArray() as any[]) {
    if (child instanceof Y.XmlElement) {
      const node = createNodeFromYElement(child, schema, meta);
      if (node) {
        children.push(node);
      }
      continue;
    }

    if (child instanceof Y.XmlText) {
      children.push(...createTextNodesFromYText(child, schema, meta));
    }
  }

  try {
    const node = schema.node(element.nodeName, element.getAttributes(), children);
    meta.mapping.set(element, node);
    return node;
  } catch (_error) {
    return null;
  }
};

export const isYXmlFragmentEmpty = (fragment: Y.XmlFragment | null | undefined) =>
  !fragment || fragment.toArray().length === 0;

export const yXmlFragmentToLumenRootNode = (
  fragment: Y.XmlFragment,
  schema: Schema,
  meta = createBindingMeta()
) => {
  const content = fragment
    .toArray()
    .map((item) => (item instanceof Y.XmlElement ? createNodeFromYElement(item, schema, meta) : null))
    .filter(Boolean) as any[];

  if (content.length > 0) {
    return schema.topNodeType.create(null, Fragment.fromArray(content));
  }

  return schema.topNodeType.createAndFill() || schema.topNodeType.create(null, Fragment.empty);
};

export const initLumenDoc = (fragment: Y.XmlFragment, schema: Schema) => {
  const meta = createBindingMeta();
  const doc = yXmlFragmentToLumenRootNode(fragment, schema, meta);

  return {
    doc,
    meta,
    mapping: meta.mapping,
  };
};

const normalizePNodeContent = (node: any) => {
  const content = node?.content?.content || [];
  const normalized: any[] = [];

  for (let index = 0; index < content.length; index += 1) {
    const child = content[index];

    if (child?.isText) {
      const textNodes: any[] = [];
      for (let probe = index; probe < content.length && content[probe]?.isText; probe += 1) {
        textNodes.push(content[probe]);
        index = probe;
      }
      normalized.push(textNodes);
      continue;
    }

    normalized.push(child);
  }

  return normalized;
};

const createTypeFromTextNodes = (nodes: any[], meta: LumenYjsBindingMeta) => {
  const text = new Y.XmlText();

  text.applyDelta(
    nodes.map((node) => ({
      insert: node.text,
      attributes: marksToAttributes(node.marks || [], meta),
    }))
  );

  meta.mapping.set(text, nodes);
  return text;
};

const createTypeFromElementNode = (node: any, meta: LumenYjsBindingMeta) => {
  const element = new Y.XmlElement(node.type.name);

  for (const [key, value] of Object.entries(node.attrs || {})) {
    if (value != null) {
      element.setAttribute(String(key), value as any);
    }
  }

  element.insert(
    0,
    normalizePNodeContent(node).map((child) => createTypeFromTextOrElementNode(child, meta))
  );

  meta.mapping.set(element, node);
  return element;
};

const createTypeFromTextOrElementNode = (node: any, meta: LumenYjsBindingMeta) =>
  Array.isArray(node) ? createTypeFromTextNodes(node, meta) : createTypeFromElementNode(node, meta);

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const equalAttrs = (left: Record<string, any> = {}, right: Record<string, any> = {}) => {
  const leftKeys = Object.keys(left).filter((key) => left[key] != null);
  const rightKeys = Object.keys(right).filter((key) => right[key] != null);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftValue = left[key];
    const rightValue = right[key];

    if (leftValue === rightValue) {
      return true;
    }

    if (isObject(leftValue) && isObject(rightValue)) {
      return equalAttrs(leftValue, rightValue);
    }

    return false;
  });
};

const equalYTextPText = (ytext: Y.XmlText, textNodes: any[]) => {
  const deltas = ytext.toDelta();

  if (deltas.length !== textNodes.length) {
    return false;
  }

  return deltas.every((delta, index) => {
    const textNode = textNodes[index];
    if (delta?.insert !== textNode?.text) {
      return false;
    }
    return equalAttrs(delta.attributes || {}, marksToAttributes(textNode?.marks || [], createBindingMeta()));
  });
};

const equalYTypePNode = (ytype: any, pnode: any): boolean => {
  if (ytype instanceof Y.XmlElement && !Array.isArray(pnode) && ytype.nodeName === pnode?.type?.name) {
    const normalizedContent = normalizePNodeContent(pnode);
    const ychildren = ytype.toArray();

    if (ychildren.length !== normalizedContent.length) {
      return false;
    }

    if (!equalAttrs(ytype.getAttributes(), pnode.attrs || {})) {
      return false;
    }

    return ychildren.every((ychild, index) => equalYTypePNode(ychild, normalizedContent[index]));
  }

  if (ytype instanceof Y.XmlText && Array.isArray(pnode)) {
    return equalYTextPText(ytype, pnode);
  }

  return false;
};

const mappedIdentity = (mapped: any, content: any) => {
  if (mapped === content) {
    return true;
  }

  if (!Array.isArray(mapped) || !Array.isArray(content) || mapped.length !== content.length) {
    return false;
  }

  return mapped.every((item, index) => item === content[index]);
};

const computeChildEqualityFactor = (ytype: Y.XmlElement, pnode: any, meta: LumenYjsBindingMeta) => {
  const ychildren = ytype.toArray();
  const pchildren = normalizePNodeContent(pnode);
  const minCount = Math.min(ychildren.length, pchildren.length);
  let left = 0;
  let right = 0;
  let foundMappedChild = false;

  for (; left < minCount; left += 1) {
    const leftY = ychildren[left];
    const leftP = pchildren[left];
    if (mappedIdentity(meta.mapping.get(leftY), leftP)) {
      foundMappedChild = true;
      continue;
    }
    if (!equalYTypePNode(leftY, leftP)) {
      break;
    }
  }

  for (; left + right < minCount; right += 1) {
    const rightY = ychildren[ychildren.length - right - 1];
    const rightP = pchildren[pchildren.length - right - 1];
    if (mappedIdentity(meta.mapping.get(rightY), rightP)) {
      foundMappedChild = true;
      continue;
    }
    if (!equalYTypePNode(rightY, rightP)) {
      break;
    }
  }

  return {
    equalityFactor: left + right,
    foundMappedChild,
  };
};

const ytextTrans = (ytext: Y.XmlText) => {
  let text = "";
  let node: any = (ytext as any)._start;
  const attrs: Record<string, any> = {};

  while (node != null) {
    if (!node.deleted) {
      if (node.countable && node.content instanceof (Y as any).ContentString) {
        text += node.content.str;
      } else if (node.content instanceof (Y as any).ContentFormat) {
        attrs[node.content.key] = null;
      }
    }
    node = node.right;
  }

  return { text, attrs };
};

const simpleDiff = (left: string, right: string) => {
  let index = 0;

  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }

  let leftIndex = left.length - 1;
  let rightIndex = right.length - 1;

  while (leftIndex >= index && rightIndex >= index && left[leftIndex] === right[rightIndex]) {
    leftIndex -= 1;
    rightIndex -= 1;
  }

  return {
    index,
    remove: Math.max(0, leftIndex - index + 1),
    insert: right.slice(index, rightIndex + 1),
  };
};

const updateYText = (ytext: Y.XmlText, textNodes: any[], meta: LumenYjsBindingMeta) => {
  meta.mapping.set(ytext, textNodes);

  const { text, attrs } = ytextTrans(ytext);
  const content = textNodes.map((node) => ({
    insert: node.text,
    attributes: {
      ...attrs,
      ...marksToAttributes(node.marks || [], meta),
    },
  }));

  const nextText = content.map((item) => item.insert).join("");
  const diff = simpleDiff(text, nextText);

  if (diff.remove > 0) {
    ytext.delete(diff.index, diff.remove);
  }

  if (diff.insert.length > 0) {
    ytext.insert(diff.index, diff.insert);
  }

  ytext.applyDelta(
    content.map((item) => ({
      retain: item.insert.length,
      attributes: item.attributes,
    }))
  );
};

export const updateYFragment = (
  yowner: { transact: (fn: () => void, origin?: any) => void },
  fragment: Y.XmlFragment,
  node: any,
  meta: LumenYjsBindingMeta,
  origin?: any
) => {
  if (fragment instanceof Y.XmlElement && fragment.nodeName !== node.type.name) {
    throw new Error("Yjs node name mismatch.");
  }

  meta.mapping.set(fragment, node);

  if (fragment instanceof Y.XmlElement) {
    const yattrs = fragment.getAttributes();
    const pattrs = node.attrs || {};

    for (const [key, value] of Object.entries(pattrs)) {
      if (value != null && yattrs[key] !== value) {
        fragment.setAttribute(key, value);
      } else if (value == null && yattrs[key] !== undefined) {
        fragment.removeAttribute(key);
      }
    }

    for (const key of Object.keys(yattrs)) {
      if (!(key in pattrs)) {
        fragment.removeAttribute(key);
      }
    }
  }

  const pchildren = normalizePNodeContent(node);
  const ychildren = fragment.toArray();
  const pcount = pchildren.length;
  const ycount = ychildren.length;
  const minCount = Math.min(pcount, ycount);
  let left = 0;
  let right = 0;

  for (; left < minCount; left += 1) {
    const leftY = ychildren[left];
    const leftP = pchildren[left];
    if (mappedIdentity(meta.mapping.get(leftY), leftP)) {
      continue;
    }
    if (equalYTypePNode(leftY, leftP)) {
      meta.mapping.set(leftY, leftP);
      continue;
    }
    break;
  }

  for (; right + left + 1 < minCount; right += 1) {
    const rightY = ychildren[ycount - right - 1];
    const rightP = pchildren[pcount - right - 1];
    if (mappedIdentity(meta.mapping.get(rightY), rightP)) {
      continue;
    }
    if (equalYTypePNode(rightY, rightP)) {
      meta.mapping.set(rightY, rightP);
      continue;
    }
    break;
  }

  yowner.transact(() => {
    while (ycount - left - right > 0 && pcount - left - right > 0) {
      const leftY = ychildren[left];
      const leftP = pchildren[left];
      const rightY = ychildren[ycount - right - 1];
      const rightP = pchildren[pcount - right - 1];

      if (leftY instanceof Y.XmlText && Array.isArray(leftP)) {
        if (!equalYTextPText(leftY, leftP)) {
          updateYText(leftY, leftP, meta);
        }
        left += 1;
        continue;
      }

      let updateLeft = leftY instanceof Y.XmlElement && leftY.nodeName === leftP?.type?.name;
      let updateRight = rightY instanceof Y.XmlElement && rightY.nodeName === rightP?.type?.name;

      if (updateLeft && updateRight) {
        const leftEquality = computeChildEqualityFactor(leftY as Y.XmlElement, leftP, meta);
        const rightEquality = computeChildEqualityFactor(rightY as Y.XmlElement, rightP, meta);

        if (leftEquality.foundMappedChild && !rightEquality.foundMappedChild) {
          updateRight = false;
        } else if (!leftEquality.foundMappedChild && rightEquality.foundMappedChild) {
          updateLeft = false;
        } else if (leftEquality.equalityFactor < rightEquality.equalityFactor) {
          updateLeft = false;
        } else {
          updateRight = false;
        }
      }

      if (updateLeft) {
        updateYFragment(yowner, leftY as Y.XmlFragment, leftP, meta);
        left += 1;
        continue;
      }

      if (updateRight) {
        updateYFragment(yowner, rightY as Y.XmlFragment, rightP, meta);
        right += 1;
        continue;
      }

      meta.mapping.delete((fragment as any).get(left));
      fragment.delete(left, 1);
      fragment.insert(left, [createTypeFromTextOrElementNode(leftP, meta)]);
      left += 1;
    }

    const yDeleteLength = ycount - left - right;
    if (ycount === 1 && pcount === 0 && ychildren[0] instanceof Y.XmlText) {
      meta.mapping.delete(ychildren[0]);
      ychildren[0].delete(0, ychildren[0].length);
    } else if (yDeleteLength > 0) {
      fragment.slice(left, left + yDeleteLength).forEach((type: any) => meta.mapping.delete(type));
      fragment.delete(left, yDeleteLength);
    }

    if (left + right < pcount) {
      const inserted = [];
      for (let index = left; index < pcount - right; index += 1) {
        inserted.push(createTypeFromTextOrElementNode(pchildren[index], meta));
      }
      fragment.insert(left, inserted);
    }
  }, origin);
};

export const lumenRootNodeToYXmlFragment = (
  doc: any,
  fragment?: Y.XmlFragment | null,
  origin?: any
) => {
  const target = fragment || new Y.XmlFragment();
  const owner =
    target.doc ||
    ({
      transact: (fn: () => void) => {
        fn();
      },
    } as any);

  updateYFragment(owner, target, doc, createBindingMeta(), origin);
  return target;
};

const createRelativePosition = (type: any, item: any) => {
  let typeid = null;
  let tname = null;

  if (type._item == null) {
    tname = Y.findRootTypeKey(type);
  } else {
    typeid = Y.createID(type._item.id.client, type._item.id.clock);
  }

  return new Y.RelativePosition(typeid, tname, item.id);
};

export const absolutePositionToRelativePosition = (
  pos: number,
  fragment: Y.XmlFragment,
  mapping: LumenYjsMapping
) => {
  if (pos === 0) {
    return Y.createRelativePositionFromTypeIndex(fragment, 0, -1);
  }

  let current: any =
    (fragment as any)._first == null ? null : (((fragment as any)._first as any).content as any).type;

  while (current != null && current !== fragment) {
    if (current instanceof Y.XmlText) {
      if (current._length >= pos) {
        return Y.createRelativePositionFromTypeIndex(current, pos, -1);
      }

      pos -= current._length;

      if (current._item?.next) {
        current = (current._item.next.content as any).type;
      } else {
        do {
          current = current._item == null ? null : current._item.parent;
          pos -= 1;
        } while (current !== fragment && current != null && current._item?.next == null);

        if (current != null && current !== fragment) {
          current = (current._item.next.content as any).type;
        }
      }

      continue;
    }

    const nodeSize = Number(mapping.get(current)?.nodeSize) || 0;

    if (current._first != null && pos < nodeSize) {
      current = (current._first.content as any).type;
      pos -= 1;
      continue;
    }

    if (pos === 1 && current._length === 0 && nodeSize > 1) {
      return new Y.RelativePosition(
        current._item == null ? null : current._item.id,
        current._item == null ? Y.findRootTypeKey(current) : null,
        null
      );
    }

    pos -= nodeSize;

    if (current._item?.next) {
      current = (current._item.next.content as any).type;
      continue;
    }

    if (pos === 0) {
      current = current._item == null ? current : current._item.parent;
      return new Y.RelativePosition(
        current._item == null ? null : current._item.id,
        current._item == null ? Y.findRootTypeKey(current) : null,
        null
      );
    }

    do {
      current = current._item?.parent ?? null;
      pos -= 1;
    } while (current !== fragment && current?._item?.next == null);

    if (current !== fragment) {
      current = (current._item.next.content as any).type;
    }
  }

  return Y.createRelativePositionFromTypeIndex(fragment, fragment.length, -1);
};

export const relativePositionToAbsolutePosition = (
  doc: Y.Doc,
  fragment: Y.XmlFragment,
  relativePosition: Y.RelativePosition,
  mapping: LumenYjsMapping
) => {
  const absolute = Y.createAbsolutePositionFromRelativePosition(relativePosition, doc);

  if (!absolute || (absolute.type !== fragment && !Y.isParentOf(fragment, absolute.type._item))) {
    return null;
  }

  let current: any = absolute.type;
  let pos = 0;

  if (current instanceof Y.XmlText) {
    pos = absolute.index;
  } else if (current._item == null || !current._item.deleted) {
    let node = current._first;
    let index = 0;

    while (index < current._length && index < absolute.index && node != null) {
      if (!node.deleted) {
        const contentType = (node.content as any).type;
        index += 1;
        if (contentType instanceof Y.XmlText) {
          pos += contentType._length;
        } else {
          pos += Number(mapping.get(contentType)?.nodeSize) || 0;
        }
      }
      node = node.right;
    }

    pos += 1;
  }

  while (current !== fragment && current._item != null) {
    const parent = current._item.parent;

    if (parent._item == null || !parent._item.deleted) {
      pos += 1;
      let node = parent._first;

      while (node != null) {
        const contentType = (node.content as any).type;
        if (contentType === current) {
          break;
        }
        if (!node.deleted) {
          if (contentType instanceof Y.XmlText) {
            pos += contentType._length;
          } else {
            pos += Number(mapping.get(contentType)?.nodeSize) || 0;
          }
        }
        node = node.right;
      }
    }

    current = parent;
  }

  return pos - 1;
};

export const getRelativeSelection = (
  fragment: Y.XmlFragment,
  mapping: LumenYjsMapping,
  state: any
): LumenRelativeSelection => {
  const selection = state?.selection;
  const type = selection instanceof AllSelection ? "all" : selection instanceof NodeSelection ? "node" : "text";

  return {
    type,
    anchor: absolutePositionToRelativePosition(selection.anchor, fragment, mapping),
    head: absolutePositionToRelativePosition(selection.head, fragment, mapping),
  };
};

const createSafeNodeSelection = (doc: any, pos: number) => {
  const $pos = doc.resolve(pos);
  if ($pos.nodeAfter) {
    return NodeSelection.create(doc, pos);
  }
  return TextSelection.near($pos);
};

export const restoreRelativeSelection = (
  doc: Y.Doc,
  fragment: Y.XmlFragment,
  mapping: LumenYjsMapping,
  nextDoc: any,
  relativeSelection: LumenRelativeSelection | null
) => {
  if (!relativeSelection) {
    return Selection.atEnd(nextDoc);
  }

  if (relativeSelection.type === "all") {
    return new AllSelection(nextDoc);
  }

  const anchor =
    relativeSelection.anchor == null
      ? null
      : relativePositionToAbsolutePosition(doc, fragment, relativeSelection.anchor, mapping);

  const head =
    relativeSelection.head == null
      ? null
      : relativePositionToAbsolutePosition(doc, fragment, relativeSelection.head, mapping);

  if (relativeSelection.type === "node") {
    if (anchor == null) {
      return Selection.atEnd(nextDoc);
    }
    return createSafeNodeSelection(nextDoc, anchor);
  }

  if (anchor == null || head == null) {
    return Selection.atEnd(nextDoc);
  }

  return TextSelection.between(nextDoc.resolve(anchor), nextDoc.resolve(head));
};

export const relativeSelectionToJSON = (selection: LumenRelativeSelection | null) => {
  if (!selection) {
    return null;
  }

  return {
    type: selection.type,
    anchor: selection.anchor ? (selection.anchor as any).toJSON?.() || selection.anchor : null,
    head: selection.head ? (selection.head as any).toJSON?.() || selection.head : null,
  };
};

export const relativeSelectionFromJSON = (selection: any): LumenRelativeSelection | null => {
  if (!selection) {
    return null;
  }

  return {
    type: selection.type === "all" || selection.type === "node" ? selection.type : "text",
    anchor: selection.anchor ? Y.createRelativePositionFromJSON(selection.anchor) : null,
    head: selection.head ? Y.createRelativePositionFromJSON(selection.head) : null,
  };
};

