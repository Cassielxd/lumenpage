/*
 * 文件说明：旧的文档模型（历史遗留）。
 * 主要职责：字符串文档变更通知，当前已由 PM 替代。
 */

export class DocModel {
  constructor(text = "") {
    this.text = text;
    this.subscribers = new Set();
  }

  getText() {
    return this.text;
  }

  setText(text) {
    if (text === this.text) {
      return;
    }
    this.text = text;
    for (const fn of this.subscribers) {
      fn(this.text);
    }
  }

  onChange(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
}
