import { atom } from "jotai";
import type { EditorView } from "lumenpage-view-types";

export const editorViewAtom = atom<EditorView | null>(null);

