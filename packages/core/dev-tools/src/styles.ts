const STYLE_ID = "lumenpage-dev-tools-style";

const DEV_TOOLS_CSS = `
.lumenpage-dev-tools {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 2147483000;
  color: #cdd6f4;
  font-family: "Helvetica Neue", "Calibri Light", Roboto, sans-serif;
}

.lumenpage-dev-tools *,
.lumenpage-dev-tools *::before,
.lumenpage-dev-tools *::after {
  box-sizing: border-box;
}

.lumenpage-dev-tools__button {
  appearance: none;
  position: fixed;
  right: 16px;
  bottom: 16px;
  border: none;
  background: #1e1e2e;
  color: inherit;
  cursor: pointer;
  border-radius: 999px;
  box-shadow: 0 0 30px #11111b;
  padding: 4px 6px;
  font-size: 12px;
  transition: opacity 0.3s;
}

.lumenpage-dev-tools__button svg {
  width: 34px;
  height: 34px;
  position: relative;
  bottom: -2px;
}

.lumenpage-dev-tools__button:hover {
  opacity: 0.7;
}

.lumenpage-dev-tools__shell {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 50vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #1e1e2e;
  box-shadow: none;
  border-radius: 0;
  font-size: 13px;
}

.lumenpage-dev-tools__tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0;
  padding: 0;
  border-bottom: 1px solid rgba(203, 166, 247, 0.2);
}

.lumenpage-dev-tools__tab {
  border: none;
  background: transparent;
  color: #cdd6f4;
  border-radius: 0;
  padding: 16px 24px 14px;
  cursor: pointer;
  font-size: 13px;
  text-transform: uppercase;
  user-select: none;
}

.lumenpage-dev-tools__tab--active {
  border-bottom: 2px solid #cba6f7;
}

.lumenpage-dev-tools__tab:hover {
  background: rgba(205, 214, 244, 0.05);
}

.lumenpage-dev-tools__content {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.lumenpage-dev-tools__content-body {
  height: calc(100% - 48px);
  overflow: hidden;
}

.lumenpage-dev-tools__close {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  padding: 10px 16px;
  background: none;
  border: none;
  color: rgba(205, 214, 244, 0.6);
  font-size: 18px;
  cursor: pointer;
}

.lumenpage-dev-tools__close:hover {
  background: rgba(205, 214, 244, 0.05);
  color: #cdd6f4;
}

.lumenpage-dev-tools__save-snapshot {
  appearance: none;
  position: absolute;
  right: 32px;
  top: -28px;
  color: #ffffff;
  background: rgba(203, 166, 247, 0.6);
  font-size: 12px;
  line-height: 25px;
  padding: 0 6px;
  height: 24px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
}

.lumenpage-dev-tools__save-snapshot:hover {
  background: rgba(203, 166, 247, 0.8);
}

.lumenpage-dev-tools__section {
  margin-bottom: 9px;
}

.lumenpage-dev-tools__stack > * + * {
  margin-top: 9px;
}

.lumenpage-dev-tools__section-header {
  padding: 0 0 9px;
  font-size: 14px;
  font-weight: 400;
}

.lumenpage-dev-tools__section-body {
  padding: 0;
}

.lumenpage-dev-tools__heading-row {
  display: flex;
  align-items: center;
}

.lumenpage-dev-tools__heading {
  color: #b4befe;
  padding: 0;
  margin: 0;
  font-weight: 400;
  letter-spacing: 1px;
  font-size: 13px;
  text-transform: uppercase;
  flex-grow: 1;
}

.lumenpage-dev-tools__heading-button {
  padding: 6px 10px;
  margin: -6px -10px 0 8px;
  font-weight: 400;
  letter-spacing: 1px;
  font-size: 11px;
  color: rgba(205, 214, 244, 0.8);
  text-transform: uppercase;
  transition: background 0.3s, color 0.3s;
  border-radius: 2px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.lumenpage-dev-tools__heading-button:hover {
  background: rgba(203, 166, 247, 0.4);
  color: #cdd6f4;
}

.lumenpage-dev-tools__group {
  margin: 0.5em 0 0.5em 1em;
}

.lumenpage-dev-tools__group-row {
  padding-top: 0.25em;
}

.lumenpage-dev-tools__group-key {
  display: inline-block;
  color: #89dceb;
  margin: 0 0.5em 0 0;
}

.lumenpage-dev-tools__group-value {
  color: #fab387;
}

.lumenpage-dev-tools__split {
  display: flex;
  height: 100%;
  min-height: 100%;
}

.lumenpage-dev-tools__split-left,
.lumenpage-dev-tools__split-right {
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}

.lumenpage-dev-tools__split-left {
  min-width: 190px;
}

.lumenpage-dev-tools__split-right {
  flex-grow: 1;
  padding: 16px 18px 18px;
  border-left: 1px solid rgba(203, 166, 247, 0.2);
}

.lumenpage-dev-tools__list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.lumenpage-dev-tools__list-item {
  width: 100%;
  text-align: left;
  border: none;
  border-top: 1px solid rgba(203, 166, 247, 0.2);
  background: transparent;
  color: rgba(205, 214, 244, 0.8);
  border-radius: 0;
  padding: 6px 18px;
  cursor: pointer;
  font-size: 11px;
  font-family: monospace;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.lumenpage-dev-tools__list-item:hover {
  background: rgba(203, 166, 247, 0.4);
  color: #cdd6f4;
}

.lumenpage-dev-tools__list-item--active {
  background: rgba(203, 166, 247, 0.4);
}

.lumenpage-dev-tools__list-item--previous {
  background: rgba(203, 166, 247, 0.2);
}

.lumenpage-dev-tools__list-item--nested {
  padding-left: 36px;
}

.lumenpage-dev-tools__list-item--muted {
  opacity: 0.3;
}

.lumenpage-dev-tools__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 9px;
}

.lumenpage-dev-tools__meta-card {
  padding: 9px 10px;
  background: rgba(205, 214, 244, 0.05);
}

.lumenpage-dev-tools__meta-key {
  font-size: 11px;
  color: rgba(205, 214, 244, 0.6);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.lumenpage-dev-tools__meta-value {
  font-size: 13px;
  color: #cdd6f4;
  word-break: break-word;
}

.lumenpage-dev-tools__code {
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(205, 214, 244, 0.05);
}

.lumenpage-dev-tools__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.lumenpage-dev-tools__input {
  width: 100%;
  border-radius: 0;
  border: 1px solid #b4befe;
  background: transparent;
  color: #b4befe;
  padding: 6px;
  font-size: 12px;
  outline: none;
}

.lumenpage-dev-tools__input::placeholder {
  color: rgba(205, 214, 244, 0.2);
}

.lumenpage-dev-tools__toolbar-button {
  color: #b4befe;
  padding: 6px;
  font-weight: 400;
  font-size: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
}

.lumenpage-dev-tools__toolbar-button:hover {
  background: rgba(205, 214, 244, 0.1);
}

.lumenpage-dev-tools__action-button {
  padding: 6px 10px;
  font-weight: 400;
  letter-spacing: 1px;
  font-size: 11px;
  color: rgba(205, 214, 244, 0.8);
  background: rgba(205, 214, 244, 0.1);
  text-transform: uppercase;
  transition: background 0.3s, color 0.3s;
  border-radius: 2px;
  border: none;
  cursor: pointer;
}

.lumenpage-dev-tools__action-button + .lumenpage-dev-tools__action-button {
  margin-left: 4px;
}

.lumenpage-dev-tools__action-button:hover {
  background: rgba(203, 166, 247, 0.4);
  color: #cdd6f4;
}

.lumenpage-dev-tools__snapshot-row {
  height: 24px;
  line-height: 24px;
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
}

.lumenpage-dev-tools__snapshot-title {
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 8px;
}

.lumenpage-dev-tools__graph {
  margin-top: 12px;
}

.lumenpage-dev-tools__graph-block-content {
  padding: 0 12px;
  box-sizing: border-box;
  border-left: 1px solid rgba(205, 214, 244, 0.2);
  border-right: 1px solid rgba(205, 214, 244, 0.2);
}

.lumenpage-dev-tools__graph-inline-content {
  padding: 0 12px;
  display: flex;
  width: 100%;
  box-sizing: border-box;
  border-left: 1px solid rgba(205, 214, 244, 0.2);
  border-right: 1px solid rgba(205, 214, 244, 0.2);
  flex-wrap: wrap;
}

.lumenpage-dev-tools__graph-row {
  width: 100%;
  margin-bottom: 3px;
  box-sizing: border-box;
  display: flex;
  color: #1e1e2e;
}

.lumenpage-dev-tools__graph-row:hover {
  cursor: pointer;
}

.lumenpage-dev-tools__graph-row--inline {
  width: auto;
  flex-grow: 1;
}

.lumenpage-dev-tools__graph-side {
  padding: 3px 6px;
  background: rgba(255, 255, 255, 0.3);
  color: #1e1e2e;
}

.lumenpage-dev-tools__graph-start {
  padding: 3px 6px;
  white-space: pre;
  color: #1e1e2e;
}

.lumenpage-dev-tools__graph-center {
  flex-grow: 1;
  padding: 3px 9px;
  white-space: pre;
  color: #1e1e2e;
}

.lumenpage-dev-tools__graph-bar {
  flex-grow: 1;
}

.lumenpage-dev-tools__tree {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.lumenpage-dev-tools__tree-row {
  padding: 8px 10px;
  background: rgba(205, 214, 244, 0.05);
}

.lumenpage-dev-tools__tree-children {
  margin-left: 18px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lumenpage-dev-tools__schema-tree {
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
}

.lumenpage-dev-tools__schema-node {
  padding: 2px 0;
}

.lumenpage-dev-tools__schema-key {
  color: #89dceb;
  margin-right: 6px;
}

.lumenpage-dev-tools__schema-value {
  color: #fab387;
}

.lumenpage-dev-tools__schema-details {
  display: inline-block;
  width: 100%;
}

.lumenpage-dev-tools__schema-summary {
  cursor: pointer;
  list-style: none;
  color: rgba(205, 214, 244, 0.8);
}

.lumenpage-dev-tools__schema-summary::-webkit-details-marker {
  display: none;
}

.lumenpage-dev-tools__schema-summary::before {
  content: "▸";
  display: inline-block;
  margin-right: 6px;
  color: rgba(205, 214, 244, 0.6);
}

.lumenpage-dev-tools__schema-details[open] > .lumenpage-dev-tools__schema-summary::before {
  content: "▾";
}

.lumenpage-dev-tools__schema-bracket {
  color: rgba(205, 214, 244, 0.8);
}

.lumenpage-dev-tools__schema-children {
  padding-left: 18px;
  margin-top: 4px;
}

.lumenpage-dev-tools__schema-row {
  padding: 2px 0;
}

.lumenpage-dev-tools__json-viewer {
  padding: 6px 0 0;
}

.lumenpage-dev-tools__json-viewer .vjs-tree {
  font-family: Monaco, Menlo, Consolas, "Courier New", monospace;
  font-size: 12px;
  color: #cdd6f4;
}

.lumenpage-dev-tools__json-viewer .vjs-tree-node {
  line-height: 18px;
  border-radius: 2px;
}

.lumenpage-dev-tools__json-viewer .vjs-tree-node:hover,
.lumenpage-dev-tools__json-viewer .vjs-tree-node.is-highlight,
.lumenpage-dev-tools__json-viewer .vjs-tree-node.dark:hover,
.lumenpage-dev-tools__json-viewer .vjs-tree-node.dark.is-highlight {
  background: rgba(203, 166, 247, 0.16);
}

.lumenpage-dev-tools__json-viewer .vjs-key {
  color: #89dceb;
}

.lumenpage-dev-tools__json-viewer .vjs-value-string {
  color: #a6e3a1;
}

.lumenpage-dev-tools__json-viewer .vjs-value-number,
.lumenpage-dev-tools__json-viewer .vjs-value-boolean {
  color: #fab387;
}

.lumenpage-dev-tools__json-viewer .vjs-value-null,
.lumenpage-dev-tools__json-viewer .vjs-value-undefined {
  color: #f38ba8;
}

.lumenpage-dev-tools__json-viewer .vjs-comment,
.lumenpage-dev-tools__json-viewer .vjs-node-index,
.lumenpage-dev-tools__json-viewer .vjs-colon {
  color: rgba(205, 214, 244, 0.58);
}

.lumenpage-dev-tools__json-viewer .vjs-carets,
.lumenpage-dev-tools__json-viewer .vjs-tree-brackets {
  color: rgba(205, 214, 244, 0.75);
}

.lumenpage-dev-tools__json-viewer .vjs-carets:hover,
.lumenpage-dev-tools__json-viewer .vjs-tree-brackets:hover {
  color: #cba6f7;
}

.lumenpage-dev-tools__json-action {
  border: none;
  background: transparent;
  color: rgba(205, 214, 244, 0.6);
  cursor: pointer;
  font: inherit;
  padding: 0;
}

.lumenpage-dev-tools__json-action:hover {
  color: #cdd6f4;
}

.lumenpage-dev-tools__highlighter {
  padding: 9px 0 18px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: rgba(205, 214, 244, 0.8);
  font-family: Monaco, Menlo, Consolas, "Courier New", monospace;
  font-size: 12px;
}

.lumenpage-dev-tools__highlighter-tag {
  color: #cba6f7;
}

.lumenpage-dev-tools__diff-tree {
  font-family: Monaco, Menlo, Consolas, "Courier New", monospace;
  font-size: 12px;
  color: #cdd6f4;
}

.lumenpage-dev-tools__diff-brace {
  color: rgba(205, 214, 244, 0.6);
}

.lumenpage-dev-tools__diff-children {
  padding-left: 16px;
}

.lumenpage-dev-tools__diff-row {
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}

.lumenpage-dev-tools__diff-key {
  color: #89dceb;
}

.lumenpage-dev-tools__diff-colon,
.lumenpage-dev-tools__diff-raw {
  color: #cdd6f4;
}

.lumenpage-dev-tools__diff-added,
.lumenpage-dev-tools__diff-deleted {
  display: inline-block;
  padding: 1px 3px 2px;
  min-height: 1ex;
  text-indent: 0;
  background: rgba(205, 214, 244, 0.2);
}

.lumenpage-dev-tools__diff-added {
  color: #a6e3a1;
}

.lumenpage-dev-tools__diff-deleted {
  color: #f38ba8;
  text-decoration: line-through;
}

.lumenpage-dev-tools__diff-updated {
  color: #cba6f7;
}

.lumenpage-dev-tools__muted {
  color: rgba(205, 214, 244, 0.6);
}

.lumenpage-dev-tools__empty {
  padding: 24px 12px;
  text-align: center;
  color: rgba(205, 214, 244, 0.6);
}

@media (max-width: 880px) {
  .lumenpage-dev-tools__shell {
    height: 55vh;
  }

  .lumenpage-dev-tools__split {
    flex-direction: column;
  }
}
`;

export function ensureDevToolsStyles() {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = DEV_TOOLS_CSS;
  document.head.appendChild(style);
}
