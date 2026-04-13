import { Extension } from "lumenpage-core";

import {
  TrackChangeMark,
  findTrackChangeRange,
  findTrackChangeRanges,
  getTrackChangeIdsAtPos,
  getTrackChangeMarksAtPos,
  listTrackChanges,
  rangeHasTrackChangeMark,
} from "./trackChangeMark.js";
import {
  TrackChangePluginKey,
  createTrackChangePlugin,
  getTrackChangePluginState,
} from "./trackChangePlugin.js";
import { TrackChangeRuntime } from "./trackChangeRuntime.js";
import { createDefaultTrackChangesOptions, type TrackChangesOptions } from "./types.js";

export const TrackChanges = Extension.create<TrackChangesOptions>({
  name: "trackChanges",
  priority: 170,
  addOptions() {
    return createDefaultTrackChangesOptions();
  },
  addExtensions() {
    return [TrackChangeMark, TrackChangeRuntime.configure(this.options)];
  },
});

export {
  TRACK_CHANGE_META,
  createDefaultTrackChangesOptions,
  markTrackChangeTransaction,
  normalizeTrackChangeAttrs,
  normalizeTrackChangeId,
  normalizeTrackChangeKind,
} from "./types.js";
export type {
  TrackChangeAttrs,
  TrackChangeKind,
  TrackChangeMeta,
  TrackChangePluginState,
  TrackChangeRange,
  TrackChangeRecord,
  TrackChangesOptions,
} from "./types.js";
export {
  TrackChangeMark,
  findTrackChangeRange,
  findTrackChangeRanges,
  getTrackChangeIdsAtPos,
  getTrackChangeMarksAtPos,
  listTrackChanges,
  rangeHasTrackChangeMark,
} from "./trackChangeMark.js";
export {
  TrackChangePluginKey,
  createTrackChangePlugin,
  getTrackChangePluginState,
} from "./trackChangePlugin.js";
export { TrackChangeRuntime } from "./trackChangeRuntime.js";

export default TrackChanges;
