<p align="center">
  <img src="./src/renderer/assets/translite-icon.png" width="96" height="96" alt="TransLite logo" />
</p>

<h1 align="center">TransLite</h1>

<p align="center">
  A lightweight desktop translator with local-trans model translation, online LLM providers, global shortcut launch, and configurable usage checks.
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green" />
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%2B-0078D4" />
  <img alt="macOS" src="https://img.shields.io/badge/macOS-12%2B-000000" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-31-blue" />
  <img alt="Vue" src="https://img.shields.io/badge/Vue-3-42b883" />
  <img alt="Naive UI" src="https://img.shields.io/badge/Naive_UI-2-18a058" />
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文</a> · <a href="./README.md"><strong>English</strong></a>
</p>

## Overview

TransLite is a lightweight desktop translation app for fast translation, offline translation, and multi-provider LLM workflows. The local translation mode is based on the local-trans model direction and uses `onnx-community/HY-MT1.5-1.8B-ONNX` as the default local model. Online mode supports providers such as DeepSeek, GLM, Kimi, OpenAI, Claude, Gemini, and OpenAI-compatible gateways.

## Screenshots

<p align="center">
  <table>
    <tr>
      <td align="center"><b>Translate Workspace</b><br><img src="docs/snipaste/image1.png" width="420" /></td>
      <td align="center"><b>Provider Settings</b><br><img src="docs/snipaste/image2.png" width="420" /></td>
    </tr>
  </table>
</p>

## Features

- Quick-open desktop translation window with a global shortcut.
- Local-trans model download, custom model directory, and local model loading.
- Online LLM provider management with Base URL, API Key, model fetching, model selection, endpoint testing, and activation.
- Official provider presets for major Chinese model platforms and GPT / Claude / Gemini.
- OpenAI-compatible and Anthropic API formats.
- Configurable usage checks through JavaScript request / extractor templates.
- Usage display for balances, plan status, Token Plan, API availability, and per-request token usage.
- Local settings storage under Electron `userData/settings.json`; no backend or database required.
- Built with Electron, Vue 3, Naive UI, CodeMirror, and Lucide Icons.

## Provider Presets

**Domestic presets**:

- DeepSeek
- GLM
- Kimi
- Alibaba Bailian / Qwen
- Doubao / Volcengine AgentPlan
- MiniMax
- Xiaomi MiMo / Xiaomi MiMo Token Plan
- StepFun
- Baichuan
- Lingyiwanwu
- SiliconFlow
- Baidu Qianfan / Qianfan Coding Plan
- Tencent Hunyuan
- SenseNova
- ModelScope
- LongCat
- Bailing

**International presets**:

- GPT / OpenAI
- Claude
- Gemini

## Usage Check Design

Usage checks are template-driven instead of hardcoded. Each template returns a request and an extractor:

```js
({
  request: {
    url: "{{baseUrl}}/api/usage",
    method: "GET",
    headers: {
      Authorization: "Bearer {{apiKey}}",
    },
  },
  extractor: function (response) {
    return {
      isValid: !response.error,
      remaining: response.balance,
      unit: "USD",
    };
  },
});
```

Core rules:

- `{{baseUrl}}` and `{{apiKey}}` are replaced in the Electron main process.
- `request` describes the HTTP request, including method, headers, and body.
- `extractor(response)` runs in a VM sandbox and must return an object.
- Supported fields include `isValid`, `invalidMessage`, `remaining`, `balance`, `unit`, `metricLabel`, `used`, `total`, `planName`, and `extra`.
- Fake balance values such as `-`, `--`, and `N/A` are filtered before display.
- Xiaomi MiMo official chat responses expose `usage.prompt_tokens`, `usage.completion_tokens`, and `usage.total_tokens` for the current request. TransLite displays this as per-request usage, not as account balance.
- Providers without public balance APIs can still display API availability and model summaries.

## Local Translation Flow

1. Switch to local mode.
2. Choose a model download or load directory.
3. Download the local-trans model or load an existing local model.
4. Enter text and translate.

The local model runs in an Electron worker thread to avoid blocking the main window.

## Online Translation Flow

1. Switch to online mode.
2. Add a provider or select an official preset.
3. Enter Base URL and API Key.
4. Fetch the model list.
5. Select a model and save.
6. Activate the provider.
7. Optionally configure usage checks and refresh usage status.

## Development

Requirements:

- Node.js 18+
- npm

Install dependencies:

```bash
npm install
```

Start Vite:

```bash
npm run dev
```

Start Electron in another terminal:

```bash
npm start
```

## Configuration Storage

TransLite has no backend or database. Desktop settings are stored under Electron's local user data directory:

```text
<Electron userData>/settings.json
```

Stored data includes:

- Current mode: local / online.
- Local model directory and load status.
- Online provider list, API keys, and active provider id.
- Usage check configuration, latest refresh time, latest result, and latest error.

## Security

- API keys are stored locally and are not uploaded to any project backend.
- Usage scripts run in an Electron main-process VM sandbox, but you should only use scripts you trust.
- TransLite does not proxy or host user requests.

## License

MIT License. You may use, copy, modify, distribute, sublicense, and sell copies of this software as long as the license notice is preserved.

See [LICENSE](./LICENSE).

## Acknowledgements

- [echosoar/local-trans](https://github.com/echosoar/local-trans): reference project for the local model translation direction.

## Community & Support

If TransLite makes your life easier, consider supporting the journey.

<div align="center">
  <table style="border: none;">
    <tr>
      <td align="center" style="border: none;">
        <p><strong>WeChat</strong></p>
        <img src="docs/images/wx.jpg" alt="WeChat" width="180" />
      </td>
      <td align="center" style="border: none;">
        <p><strong>Alipay</strong></p>
        <img src="docs/images/zfb.jpg" alt="Alipay" width="180" />
      </td>
      <!-- <td align="center" style="border: none;">
        <p><strong>QQ Group</strong></p>
        <img src="docs/images/qq.jpeg" alt="QQ Group" width="180" height="180" />
      </td> -->
    </tr>
  </table>
  <br>
  <!-- <p>Your support keeps the project active and the developer caffeinated!</p>
  <a href="https://tiez.name666.top/zh/sponsors.html"><strong>View Sponsor List</strong></a> -->
</div>

---

<div align="center">
  <b>Please consider leaving a Star if you find this project useful.</b>
</div>
