type ChunkGroup = {
  name: string;
  patterns: string[];
};

const STATIC_VENDOR_GROUPS: ChunkGroup[] = [
  {
    name: "vendor-vue",
    patterns: ["/node_modules/vue/", "/node_modules/@vue/"],
  },
  {
    name: "vendor-ui",
    patterns: [
      "/node_modules/tdesign-vue-next/",
      "/node_modules/tdesign-icons-vue-next/",
      "/node_modules/@floating-ui/",
      "/node_modules/dayjs/",
      "/node_modules/lodash/",
      "/node_modules/mitt/",
    ],
  },
  {
    name: "vendor-prosemirror",
    patterns: [
      "/node_modules/prosemirror-",
      "/node_modules/orderedmap/",
      "/node_modules/rope-sequence/",
      "/node_modules/w3c-keyname/",
    ],
  },
];

const normalizeModuleId = (id: string) => id.replace(/\\/g, "/");

export const createManualChunks = (id: string): string | undefined => {
  const normalizedId = normalizeModuleId(id);

  // Keep CSS and dynamically imported feature bundles on Rollup defaults so
  // we do not accidentally turn lazy functionality into an eager vendor chunk.
  if (
    !normalizedId.includes("/node_modules/") ||
    normalizedId.endsWith(".css") ||
    normalizedId.endsWith(".less")
  ) {
    return undefined;
  }

  for (const group of STATIC_VENDOR_GROUPS) {
    if (group.patterns.some((pattern) => normalizedId.includes(pattern))) {
      return group.name;
    }
  }

  return undefined;
};
