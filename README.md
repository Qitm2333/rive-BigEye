# BIGEYES - AI 表情伴侣

一个基于 Rive 动画的 AI 语音对话表情角色。通过语音与角色对话，角色会根据对话内容展示不同的表情动画。

## 功能特性

- 🎙️ **语音识别** - 浏览器原生 Web Speech API
- 🤖 **AI 对话** - DeepSeek 大模型驱动
- 🔊 **语音合成** - 中文语音朗读回复
- 😊 **表情动画** - Rive 动画实时响应
- 👀 **眼睛跟随** - 眼睛跟随鼠标移动

## 表情状态

| Mood | 名称 | 触发场景 |
|------|------|----------|
| 0 | Basic | 普通、开心、打招呼 |
| 1 | Upset | 生气、难过、委屈 |
| 2 | Tired | 疲惫、无聊、累了 |
| 3 | TiredHaqie | 困、想睡、打哈欠 |
| 4 | Confusion | 困惑、疑问、不解 |
| 5 | Thinking | 思考、沉思 |

## 快速开始

```bash
npm install
npm run dev
```

## 使用方法

1. 使用 **Chrome** 或 **Edge** 浏览器打开
2. 允许麦克风权限
3. 点击底部麦克风按钮开始说话
4. 角色会根据对话内容展示表情并语音回复

## 技术栈

- React 19 + Vite 7
- Rive 动画引擎
- DeepSeek API
- Web Speech API

## 配置

在 `src/App.jsx` 中设置你的 API Key：

```javascript
const DEEPSEEK_API_KEY = 'your-api-key';
```

> ⚠️ 生产环境请使用后端代理保护 API Key

## License

MIT
