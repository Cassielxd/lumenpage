import { Extension } from "lumenpage-core";

import {
  TrackChangeMark,
  findTrackChangeRange,
  findTrackChangeRanges,
  getTrackChangeIdsAtPos,
  getTrackChangeMarksAtPos,
  listTrackChanges,
  rangeHasTrackChangeMark,
} from "./trackChangeMark";
import {
  TrackChangePluginKey,
  createTrackChangePlugin,
  getTrackChangePluginState,
} from "./trackChangePlugin";
import { TrackChangeRuntime } from "./trackChangeRuntime";
import { createDefaultTrackChangesOptions, type TrackChangesOptions } from "./types";

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
} from "./types";
export type {
  TrackChangeAttrs,
  TrackChangeKind,
  TrackChangeMeta,
  TrackChangePluginState,
  TrackChangeRange,
  TrackChangeRecord,
  TrackChangesOptions,
} from "./types";
export {
  TrackChangeMark,
  findTrackChangeRange,
  findTrackChangeRanges,
  getTrackChangeIdsAtPos,
  getTrackChangeMarksAtPos,
  listTrackChanges,
  rangeHasTrackChangeMark,
} from "./trackChangeMark";
export {
  TrackChangePluginKey,
  createTrackChangePlugin,
  getTrackChangePluginState,
} from "./trackChangePlugin";
export { TrackChangeRuntime } from "./trackChangeRuntime";

export default TrackChanges;
