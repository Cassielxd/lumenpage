import { atom } from "jotai";
import type { EditorState } from "lumenpage-state";

export const editorStateAtom = atom<EditorState | null>(null);

