export const initialDocJson = {
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": {
        "level": 1
      },
      "content": [
        {
          "type": "text",
          "text": "LumenPage"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "LumenPage 是一个基于 Canvas 的分页富文本编辑器框架，面向“长文档、强排版、可扩展”的在线编辑场景。 它不是简单复刻 `contenteditable`，而是把文档模型、分页布局、渲染管线做成可控系统，目标是提供稳定的分页结果、可预测的性能与清晰的扩展边界。"
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "产品介绍"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "LumenPage 面向“在线文档/报告编辑”场景，提供接近桌面文档软件的分页编辑体验。 用户可以在同一编辑器中完成正文撰写、图文混排、表格编辑、样式排版与结构化内容组织，并在长文档场景下保持稳定排版与流畅交互。"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "当前产品形态重点解决三件事："
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "分页稳定：长文档编辑时，页面断点与布局结果可预测、可复用。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "交互一致：文本、块节点、表格、媒体等不同内容类型在同一交互模型下工作。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "能力可扩展：新节点、新工具、新交互可以通过插件化方式接入，不需要改动大量核心逻辑。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "为什么选择 LumenPage"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "分页是编辑时能力，不是导出后补救：A4 页面、页边距、跨页行为在编辑过程中实时可见。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "架构思想灵感来源于 ProseMirror：命令与插件模型清晰，同时结合 Canvas 分页渲染能力，覆盖长文档场景需求。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "长文档性能更可控：渲染与布局分层，基于布局结果做命中、选区和增量重绘，减少复杂 DOM 带来的抖动。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "架构更易演进：核心最小化，业务能力优先放插件/扩展包，降低核心耦合和回归风险。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "落地效率更高：文本、表格、图片、视频、拖拽、分页等能力可直接组合成文档产品基础设施。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "典型使用场景"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "在线报告编辑：行业报告、研究报告、项目复盘等需要分页预览和稳定排版的文档场景。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "教培与考试：讲义、作业、试卷等结构化内容，强调表格、图文混排与打印一致性。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "企业知识文档：制度文档、SOP、模板化文档，要求多人协作下样式和结构可控。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "内容生产后台：媒体稿件、运营手册、产品文档，要求长文档编辑性能稳定。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "行业垂直文档：法律、医疗、财务等高规范文本，关注可追溯、可导出、可复用版式。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "扩展的产品想象"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "模板中心：沉淀行业模板（报告、合同、制度、试卷）并支持一键套版。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "变量文档：支持占位符变量与批量生成，连接业务系统生成个性化文档。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "协同与审阅：评论、批注、建议模式、版本比对，形成完整审阅闭环。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "智能辅助：大纲生成、内容润色、结构检查、术语统一等 AI 能力按插件接入。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "输出与分发：导出 PDF/图片/可打印版本，并支持文档发布、分享与权限控制。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "业务组件市场：表单块、审批块、数据图表块等领域组件通过扩展包接入。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "1. 项目定位"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "编辑模型：架构思想灵感来源于 ProseMirror（`schema/state/transform/commands` 思想）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "视图实现：使用 Canvas 进行渲染，DOM 仅承担事件桥接与少量 overlay。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "业务方向：面向“文档编辑 + 分页排版 + 可扩展节点能力”。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "2. 核心设计思路"
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "2.1 核心最小化"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "核心只做："
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "状态流转（transaction -> state）"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "分页布局（layout）"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "渲染与命中（render/hit-test）"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "输入与选区桥接"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "能抽到扩展点的尽量抽到插件 `props`："
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`nodeViews`"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`dropCursor` / `createDropCursorDecoration`"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`resolveDragNodePos`"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`getText`"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`parseHtmlToSlice`"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`isInSpecialStructureAtPos`"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`shouldAutoAdvanceAfterEnter`"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`nodeSelectionTypes`"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`onChange`"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "2.2 分层架构"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`packages/view-canvas`：Canvas 视图层（输入、选区、渲染、分页、事件编排）"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`packages/starter-kit`：默认 schema、命令与节点渲染注册"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`packages/node-*`：节点级能力（paragraph/heading/list/table/image/video/...）"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`packages/drag-handle`：块级拖拽句柄插件（含 drop cursor 默认实现）"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`apps/playground`：演示与联调入口"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "2.3 插件优先策略"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "优先读取插件/props，旧配置（`CanvasConfig`）作为兼容回退。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "多插件冲突时采用“顺序优先”（先注册先命中）的策略。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "对于事件监听类（如 `onChange`），支持多插件同时触发。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "3. 技术栈"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "语言：TypeScript"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "工作区：pnpm workspace"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "构建：Vite + `tsc -b`"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "渲染：Canvas 2D"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "编辑模型：借鉴 ProseMirror 的状态流转与命令体系"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "UI：Vue 3 + TDesign（playground）"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "4. 运行与构建"
        }
      ]
    },
    {
      "type": "codeBlock",
      "content": [
        {
          "type": "text",
          "text": "pnpm install\npnpm dev"
        }
      ]
    },
    {
      "type": "codeBlock",
      "content": [
        {
          "type": "text",
          "text": "pnpm -r typecheck\npnpm -r build"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "仅构建演示应用："
        }
      ]
    },
    {
      "type": "codeBlock",
      "content": [
        {
          "type": "text",
          "text": "pnpm build:app"
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "5. 主要功能清单（当前状态）"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "文本编辑：段落/标题/加粗/斜体/下划线/删除线/行内代码/链接"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "块级结构：引用、代码块、分割线、列表（有序/无序）"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "媒体节点：图片、视频"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "表格：加删行列、单元格合并/拆分、单元格范围选区渲染"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "历史与输入：undo/redo、keymap、inputrules、gapcursor"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "分页：A4 尺寸、页边距、跨页布局、增量复用"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "拖拽：文本与块拖拽、drop cursor、拖拽句柄插件化"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "6. 关键实现机制"
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "6.1 渲染管线"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`state -> layout -> render -> overlay`"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "line 级布局数据用于："
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "文本定位"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "选区矩形"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "节点 overlay 同步"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "命中测试"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "6.2 选区机制"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "文本选区：基于 offset 与布局行映射"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "NodeSelection：可按插件配置控制可选节点类型"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "表格选区：支持 cell 范围背景高亮（不仅文本高亮）"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "6.3 拖拽机制"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "Canvas 环境下采用“手势内部拖拽 + 原生拖拽兼容”双路径"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "块级拖拽位置解析由插件 `resolveDragNodePos` 决定"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "drop cursor 默认由 `drag-handle` 插件提供，可覆盖/禁用"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "6.4 页面样式钩子"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`settings.renderPageBackground(args)`：自定义页面背景/边框绘制（Canvas）。返回 `true` 表示完全接管默认背景。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`settings.renderPageChrome(args)`：自定义页面装饰绘制（如四角、印章、裁切线）。返回 `true` 表示完全接管默认装饰。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`settings.onPageCanvasStyle(args)`：自定义页面 DOM 样式（如阴影、圆角、滤镜、边框）。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "示例："
        }
      ]
    },
    {
      "type": "codeBlock",
      "content": [
        {
          "type": "text",
          "text": "const settings = {\n  // ...existing settings\n  renderPageBackground: ({ ctx, width, height, drawDefaultBackground }) => {\n    drawDefaultBackground();\n    ctx.save();\n    ctx.fillStyle = \"rgba(255, 248, 220, 0.12)\";\n    ctx.fillRect(0, 0, width, height);\n    ctx.restore();\n    return true;\n  },\n  renderPageChrome: ({ ctx, width, height }) => {\n    ctx.save();\n    ctx.strokeStyle = \"#94a3b8\";\n    ctx.strokeRect(8, 8, width - 16, height - 16);\n    ctx.restore();\n    return true;\n  },\n  onPageCanvasStyle: ({ canvas }) => {\n    canvas.style.borderRadius = \"8px\";\n    canvas.style.boxShadow = \"0 12px 28px rgba(0,0,0,.12)\";\n  },\n};"
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "6.5 文档 I/O API"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "`CanvasEditorView` 现提供基础文档读写能力："
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`view.getJSON()`：获取当前文档 JSON 快照。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`view.setJSON(json)`：将 JSON 文档替换到当前编辑器实例（保留插件与视图实例）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`view.getTextContent()`：获取当前纯文本快照。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "6.6 事务权限（插件实现）"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "权限控制建议通过状态插件的 `filterTransaction(tr, state)` 实现。"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "返回 `false`：阻断本次事务。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "返回 `true`：允许事务继续应用。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "适用于只读策略、角色权限、敏感节点保护等场景，核心视图层不内置业务权限判断。"
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "7. 架构思想（灵感来源）"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "架构设计灵感来源于 ProseMirror："
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`command` 保持函数式组合（不强行塞进 props 通道）"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`props` 用于视图行为扩展与事件接管"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`plugin` 负责可插拔能力（nodeView/拖拽/装饰等）"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "Canvas 特有能力保留在视图层："
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "分页布局"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "坐标与命中映射"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "高性能重绘策略"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "8. 仓库结构"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`apps/playground`：演示应用"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`packages/view-canvas`：Canvas EditorView 与分页布局引擎"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`packages/starter-kit` + `packages/extension-*`：统一默认 schema 与扩展装配"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`packages/starter-kit`：默认 schema + commands + registry"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`packages/drag-handle`：拖拽句柄插件"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`packages/link`：链接解析与安全跳转工具"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`packages/node-*`：节点实现包"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`docs/`：设计文档与差异记录"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "9. 相关文档"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`docs/pos-offset-mapping.md`：`pos <-> offset <-> 坐标` 映射说明"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`docs/prosemirror-gap.md`：历史差异分析与演进记录"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`docs/editor-gap-roadmap.md`：完整编辑器差距清单与补齐路线图"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "10. 完整编辑器差距清单（执行中）"
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "P0（必须优先）"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "输入法与选区稳定性：IME 合成、跨节点选区、光标不丢失、不跳块。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "拖拽与选择一致性：文本拖拽、块拖拽、NodeSelection、GapCursor 交互统一。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "表格编辑完整性：Enter / Backspace / Delete、范围选区、合并拆分、行列增删回归。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "列表行为一致性：Enter 新项/退出、Backspace 回退层级/转段落、有序无序互切。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "自动化回归基线：命令级 + 事务映射 + 交互 smoke（键盘/鼠标/拖拽/粘贴）。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "P1（产品可用）"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "粘贴与导入导出：HTML/Markdown/JSON 保真与清洗策略（已接入基础 HTML/Text 粘贴清洗与 JSON 导入导出入口）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "历史与协作：Undo/Redo 边界、批事务、远端选区与冲突收敛。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "只读与权限模型：view-only / 受限编辑 / 评论态。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "链接与语义交互：编辑态、跳转态、键盘导航、包裹/拆除一致性。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "移动端触控适配：光标、长按菜单、软键盘遮挡处理。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 3
      },
      "content": [
        {
          "type": "text",
          "text": "P2（规模化）"
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "大文档性能压测与优化（分页增量复用、重排范围控制、内存）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "无障碍与国际化（键盘可达性、RTL/CJK 混排）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "安全治理（粘贴 XSS、URL 策略、媒体资源策略）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "插件生态规范（生命周期、兼容矩阵、示例与文档）。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {
        "level": 2
      },
      "content": [
        {
          "type": "text",
          "text": "11. 回归 Smoke 开关"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Playground 支持通过 URL 查询参数开启回归 smoke："
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?permissionMode=full|comment|readonly`：Playground 权限模式（插件实现）。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "说明："
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`full`：正常编辑。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`comment`：当前与 `full` 一致（预留评论态扩展入口）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`readonly`：通过插件阻断文档写入事务，并设置 `editable=false`。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?allSmoke=1`：一键执行全套 smoke（推荐本地回归入口）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?tableSmoke=1`：表格导航与命令冒烟。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?tableBehaviorSmoke=1`：表格删除/回车严格冒烟（边界删除拦截、范围删除、CellSelection 回车）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?listSmoke=1`：有序列表分页冒烟。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?listBehaviorSmoke=1`：列表行为冒烟（段落↔有序/无序切换、列表项 Enter）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?blockOutlineSmoke=1`：块容器几何一致性冒烟（`codeBlock` / `blockquote`）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?dragSmoke=1`：拖拽/选择链路冒烟（`resolveDragNodePos`、dropCursor、媒体 NodeSelection）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?dragActionSmoke=1`：真实内部拖拽动作冒烟（文本 + 媒体节点的 `start -> update -> finish` 移动）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?selectionImeSmoke=1`：选区/中文输入路径冒烟（文本插入、映射回环、NodeSelection 往返）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?imeActionSmoke=1`：真实组合输入事件冒烟（composition start/update/end + beforeinput）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?selectionBoundarySmoke=1`：节点选区/间隙选区边界冒烟（GapCursor 与 NodeSelection 往返）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?toolSmoke=1`：工具栏命令冒烟（加粗/斜体/下划线/链接/标题段落切换）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?pasteSmoke=1`：真实粘贴事件冒烟（plain text + HTML）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?historySmoke=1`：历史栈冒烟（插入后 undo/redo 可逆）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?mappingSmoke=1`：`pos <-> offset` 映射冒烟（roundtrip 与单调性）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?coordsSmoke=1`：`coordsAtPos/posAtCoords` 命中回环冒烟。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?readonlySmoke=1`：只读态冒烟（输入与内部拖拽阻断）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?docRoundtripSmoke=1`：文档 JSON 往返冒烟（`toJSON -> nodeFromJSON`）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`?markdownIoSmoke=1`：Markdown 解析/序列化回环冒烟（`parse -> serialize -> parse`）。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Playground 额外能力："
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "工具栏提供 `导入JSON/导出JSON`（基于 `CanvasEditorView.setJSON/getJSON`）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "工具栏提供 `导入HTML/导出HTML`（基于 schema DOM parser/serializer）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "工具栏提供历史边界控制：`切分历史`（`closeHistory`）与 `Undo/Redo depth` 显示。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "粘贴链路接入 `transformPastedText/transformPastedHTML`："
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "统一换行与空格（`CRLF -> LF`，`NBSP -> 空格`）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "清洗危险标签与事件属性（移除 `script/style/iframe/...`、`on*`、`javascript:` URL）。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "链接交互区分编辑态与跳转态："
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`full/comment`：`Ctrl/Cmd + 点击` 才跳转，普通点击用于编辑。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`readonly`：单击直接跳转。"
                }
              ]
            }
          ]
        },
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "键盘支持 `Ctrl/Cmd + Enter`：当光标位于链接内时直接跳转。"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "建议联调参数："
        }
      ]
    },
    {
      "type": "codeBlock",
      "content": [
        {
          "type": "text",
          "text": "?devTools=1&tableSmoke=1&tableBehaviorSmoke=1&listSmoke=1&listBehaviorSmoke=1&blockOutlineSmoke=1&dragSmoke=1&dragActionSmoke=1&selectionImeSmoke=1&imeActionSmoke=1&selectionBoundarySmoke=1&toolSmoke=1&pasteSmoke=1&historySmoke=1&mappingSmoke=1&coordsSmoke=1&readonlySmoke=1&docRoundtripSmoke=1"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "或直接："
        }
      ]
    },
    {
      "type": "codeBlock",
      "content": [
        {
          "type": "text",
          "text": "?devTools=1&allSmoke=1"
        }
      ]
    },
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "`allSmoke=1` 执行后会附加一条汇总日志："
        }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                {
                  "type": "text",
                  "text": "`[all-smoke-summary] total=... pass=... fail=...`"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

