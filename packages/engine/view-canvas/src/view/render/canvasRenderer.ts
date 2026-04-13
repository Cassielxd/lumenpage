/*
 * 文件说明：渲染器轻量封装（历史兼容）。
 * 主要职责：继承/代理核心 Renderer。
 */

import { Renderer } from "../renderer.js";

export class CanvasRenderer extends Renderer {
  updateRegistry(registry) {
    this.registry = registry;
    return this;
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    return this;
  }
}
