import { Extension } from "lumenpage-core";

import {
  CollaborationCaretPluginKey,
  createCollaborationCaretPlugin,
} from "./collaborationCaretPlugin";

export type CollaborationCaretUser = {
  clientId: number;
  [key: string]: any;
};

type AwarenessLike = {
  clientID?: number;
  states?: Map<number, Record<string, any>>;
  setLocalStateField?: (field: string, value: any) => void;
  on?: (event: string, listener: () => void) => void;
  off?: (event: string, listener: () => void) => void;
};

type ProviderLike = {
  awareness?: AwarenessLike | null;
};

export type CollaborationCaretStorage = {
  users: CollaborationCaretUser[];
};

export interface CollaborationCaretOptions {
  provider: ProviderLike | null;
  user: Record<string, any>;
  render?: (user: Record<string, any>) => any;
  selectionRender?: (user: Record<string, any>) => Record<string, any>;
  onUpdate?: (users: CollaborationCaretUser[]) => void;
}

const noop = () => undefined;

export const CollaborationCaret = Extension.create<CollaborationCaretOptions, CollaborationCaretStorage>({
  name: "collaborationCaret",
  priority: 999,
  addOptions() {
    return {
      provider: null,
      user: {
        name: null,
        color: null,
      },
      render: () => null,
      selectionRender: () => ({}),
      onUpdate: noop,
    };
  },
  addStorage() {
    return {
      users: [],
    };
  },
  addCommands() {
    return {
      updateUser:
        (attributes: Record<string, any>) =>
        () => {
          const awareness = this.options.provider?.awareness;
          const nextUser = {
            ...(this.options.user || {}),
            ...(attributes || {}),
          };

          this.options.user = nextUser;
          awareness?.setLocalStateField?.("user", nextUser);
          return true;
        },
      user:
        (attributes: Record<string, any>) =>
        ({ editor }: any) => editor.commands.updateUser(attributes),
    };
  },
  addPlugins() {
    const awareness = this.options.provider?.awareness;

    if (!awareness) {
      return [];
    }

    return [
      createCollaborationCaretPlugin({
        awareness,
        storage: this.storage,
        options: this.options,
      }),
    ];
  },
});

export { CollaborationCaretPluginKey, createCollaborationCaretPlugin };

export default CollaborationCaret;
