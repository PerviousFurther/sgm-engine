# 雾隐幻想乡 / Mistbound Fantasia

一个采用 React、TypeScript 与 Canvas 2D 实现的东方风弹幕射击演示，同时包含可视化关卡编辑器。游戏运行时本身就是项目脚本的解释器，编辑器与游戏使用同一套类型定义。

## 启动

```bash
pnpm install
pnpm dev:game
```

游戏入口为 `http://localhost:5173/game.html`。

```bash
pnpm dev:editor
```

编辑器入口为 `http://localhost:5173/editor.html`。生产构建使用 `pnpm build`，类型检查使用 `pnpm typecheck`。

编辑器中的“保存”会把项目脚本写入浏览器本地存储；点击“运行游戏”会先保存，再在新标签页由游戏解释器加载。也可以导入或导出格式化的 JSON 项目脚本。

## 操作

- 方向键或 `WASD`：移动
- `Z` 或空格：射击
- `Shift`：低速移动并显示判定点
- 对话期间按住 `Z`：跳过当前对话

## 架构

```text
GameProjectDefinition
├─ SceneDefinition[]       独立的标题、选择、加载、游戏、结算、结局与制作人员场景
├─ CharacterDefinition[]   自机参数与主角 SpriteSheetDefinition
├─ AssetDefinition[]       图片与音频资源
└─ LevelDefinition[]       完整可玩关卡
   └─ LevelStage[]         关卡内条件状态节点
      ├─ TimelineEvent[]   类型化时间轴事件
      └─ StageTransition[] 条件分支
```

核心模块位于 `src/core`：

- `LevelInterpreter` 解释阶段时间轴、等待、对话暂停、变量与类型化转换。
- `EventBus` 解耦场景、阶段、敌人、弹幕、对话与计分事件。
- `BulletEngine` 组合发射器和数学运动模型。当前包含环形、扇形、流式发射，以及直线、加速、旋转、正弦、追踪和轨道扩散运动。
- `AssetStore` 统一预载图片与音频，并负责音乐播放。
- `SpriteAnimator` 按 `SpriteSheetDefinition` 播放 PNG 网格序列帧。

游戏组件位于 `src/game`，编辑器组件位于 `src/editor`，示例项目脚本位于 `src/data/demoProject.ts`。

## 扩展弹幕模型

1. 在 `BulletMotionDefinition` 中加入新的判别联合成员。
2. 在 `BulletEngine.applyMotion` 中实现该模型每帧的速度或方向变化。
3. 在弹幕编辑器的模型下拉框及 `MotionFields` 中加入参数控件。

弹幕实例记录 `ownerId`。敌人被销毁时运行时会停止它拥有的所有发射器，确保敌人所属弹幕模式不会继续生成。
