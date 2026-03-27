import { Plugin, PluginKey } from "lumenpage-state";

import type { Editor } from "./Editor";
import { CommandManager } from "./CommandManager";
import { createChainableState } from "./helpers/createChainableState";

export type Range = {
  from: number;
  to: number;
};

export type ExtendedRegExpMatchArray = RegExpMatchArray & {
  data?: Record<string, any>;
};

export type PasteRuleMatch = {
  index: number;
  text: string;
  replaceWith?: string;
  match?: RegExpMatchArray;
  data?: Record<string, any>;
};

export type PasteRuleFinder =
  | RegExp
  | ((text: string, event?: ClipboardEvent | null) => PasteRuleMatch[] | null | undefined);

type PasteRuleHandlerProps = {
  state: any;
  range: Range;
  match: ExtendedRegExpMatchArray;
  commands: Record<string, any>;
  chain: () => Record<string, any>;
  can: () => Record<string, any>;
  pasteEvent: ClipboardEvent | null;
};

export class PasteRule {
  find: PasteRuleFinder;
  handler: (props: PasteRuleHandlerProps) => void | null;

  constructor(config: { find: PasteRuleFinder; handler: (props: PasteRuleHandlerProps) => void | null }) {
    this.find = config.find;
    this.handler = config.handler;
  }
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isRegExp = (value: unknown): value is RegExp => value instanceof RegExp;

const toGlobalRegExp = (value: RegExp) =>
  value.global ? value : new RegExp(value.source, value.flags.includes("g") ? value.flags : `${value.flags}g`);

const createPasteEvent = () => {
  try {
    if (typeof ClipboardEvent !== "undefined") {
      return new ClipboardEvent("paste");
    }
  } catch (_error) {
    // Ignore environments without ClipboardEvent construction support.
  }
  return null;
};

const pasteRuleMatcherHandler = (
  text: string,
  find: PasteRuleFinder,
  event?: ClipboardEvent | null
): ExtendedRegExpMatchArray[] => {
  if (isRegExp(find)) {
    return Array.from(text.matchAll(toGlobalRegExp(find))) as ExtendedRegExpMatchArray[];
  }

  const matches = find(text, event);
  if (!matches?.length) {
    return [];
  }

  return matches.map((pasteRuleMatch) => {
    const result = [pasteRuleMatch.text] as ExtendedRegExpMatchArray;
    result.index = pasteRuleMatch.index;
    result.input = text;
    result.data = pasteRuleMatch.data;

    if (pasteRuleMatch.replaceWith) {
      result.push(pasteRuleMatch.replaceWith);
    }

    return result;
  });
};

const run = ({
  editor,
  state,
  from,
  to,
  rule,
  pasteEvent,
}: {
  editor: Editor;
  state: any;
  from: number;
  to: number;
  rule: PasteRule;
  pasteEvent: ClipboardEvent | null;
}) => {
  const manager = new CommandManager(editor, editor.rawCommands, {
    state,
    view: editor.view,
  });
  const handlers: Array<void | null> = [];

  state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (node?.type?.spec?.code || !(node?.isText || node?.isTextblock || node?.isInline)) {
      return;
    }

    const contentSize = node?.content?.size ?? node?.nodeSize ?? 0;
    const resolvedFrom = Math.max(from, pos);
    const resolvedTo = Math.min(to, pos + contentSize);

    if (resolvedFrom >= resolvedTo) {
      return;
    }

    const textToMatch = node?.isText
      ? node.text || ""
      : node.textBetween(resolvedFrom - pos, resolvedTo - pos, undefined, "\ufffc");
    const matches = pasteRuleMatcherHandler(textToMatch, rule.find, pasteEvent);

    for (const match of matches) {
      if (!isNumber(match.index)) {
        continue;
      }

      const start = resolvedFrom + match.index + 1;
      const end = start + match[0].length;
      const range = {
        from: state.tr.mapping.map(start),
        to: state.tr.mapping.map(end),
      };

      handlers.push(
        rule.handler({
          state,
          range,
          match,
          commands: manager.commands,
          chain: () => manager.chain(),
          can: () => manager.can(),
          pasteEvent,
        })
      );
    }
  });

  return handlers.every((handler) => handler !== null);
};

export const pasteRulesPlugin = ({
  editor,
  rules,
}: {
  editor: Editor;
  rules: PasteRule[];
}) => {
  let pasteEvent = createPasteEvent();

  return rules.map(
    (rule, index) =>
      new Plugin({
        key: new PluginKey(`pasteRule${index}`),
        props: {
          handlePaste: (_view: any, event: ClipboardEvent) => {
            pasteEvent = event;
            return false;
          },
        },
        appendTransaction: (transactions, oldState, newState) => {
          const transaction = transactions.find((tr: any) => tr.getMeta("uiEvent") === "paste");
          if (!transaction) {
            return null;
          }

          const from = oldState.doc.content.findDiffStart(newState.doc.content);
          const to = oldState.doc.content.findDiffEnd(newState.doc.content);

          if (!isNumber(from) || !to || from === to.b) {
            return null;
          }

          const tr = newState.tr;
          const chainableState = createChainableState({
            state: newState,
            transaction: tr,
          });
          const handled = run({
            editor,
            state: chainableState,
            from: Math.max(from - 1, 0),
            to: Math.max(to.b - 1, 0),
            rule,
            pasteEvent,
          });

          pasteEvent = createPasteEvent();

          if (!handled || !tr.steps.length) {
            return null;
          }

          return tr;
        },
      })
  );
};
