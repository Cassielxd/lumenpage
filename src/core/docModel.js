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
