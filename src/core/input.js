/*
 * 文件说明：旧的输入控制器（历史遗留）。
 * 主要职责：监听 input/keydown 并回调，当前已由输入桥接替代。
 */

export class InputController {
  constructor(element, handlers) {
    this.element = element;
    this.handlers = handlers;
    this.element.value = "";

    this.element.addEventListener("input", (event) => this.handleInput(event));
    this.element.addEventListener("keydown", (event) => this.handleKeyDown(event));
    this.element.addEventListener("focus", () => this.handlers.onFocus?.());
    this.element.addEventListener("blur", () => this.handlers.onBlur?.());
  }

  handleInput() {
    const value = this.element.value;
    if (value.length > 0) {
      this.handlers.onInsert?.(value);
      this.element.value = "";
    }
  }

  handleKeyDown(event) {
    if (event.isComposing || event.ctrlKey || event.metaKey) {
      return;
    }

    switch (event.key) {
      case "Backspace":
        event.preventDefault();
        this.handlers.onDelete?.("backward");
        break;
      case "Delete":
        event.preventDefault();
        this.handlers.onDelete?.("forward");
        break;
      case "ArrowLeft":
        event.preventDefault();
        this.handlers.onMove?.("left");
        break;
      case "ArrowRight":
        event.preventDefault();
        this.handlers.onMove?.("right");
        break;
      case "ArrowUp":
        event.preventDefault();
        this.handlers.onMove?.("up");
        break;
      case "ArrowDown":
        event.preventDefault();
        this.handlers.onMove?.("down");
        break;
      case "Home":
        event.preventDefault();
        this.handlers.onMove?.("lineStart");
        break;
      case "End":
        event.preventDefault();
        this.handlers.onMove?.("lineEnd");
        break;
      case "Enter":
        event.preventDefault();
        this.handlers.onInsert?.("\n");
        break;
      case "Tab":
        event.preventDefault();
        this.handlers.onInsert?.("  ");
        break;
      default:
        break;
    }
  }

  focus() {
    this.element.focus();
  }

  setPosition(x, y) {
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }
}
