# CodeMaestro

**AI-Powered Full-Stack Application Development System**

CodeMaestro is a comprehensive development kit and orchestration system that enables AI coding agents to autonomously build complete full-stack applications. It provides structured specifications, prompts, and workflows for AI-assisted software development.

## 📦 Repository Contents

This repository contains three main components:

### 1. CodeMaestro DevKit (Generic)
Located in `/CodeMaestro-DevKit-Generic/`

A drop-in, agent-ready development kit with:
- Markdown specifications and templates
- AI agent prompts and profiles
- Execution plans and checklists
- Testing, CI/CD, and security guidelines

### 2. CodeMaestro ProjectKit (VSCode Wrapper)
Located in `/ProjectKit-CodeMaestro-VSCode-Wrapper/`

Specialized toolkit for building VSCode extension wrappers with:
- Requirements and architecture specs
- Protocol definitions
- Testing and QA guidelines

### 3. CodeMaestro MVP Server
Located in `/server/mvp/` and `/spec/`

MVP implementation components including:
- Orchestrator state machine
- Session store specifications
- Patch format definitions
- Golden tasks and replay rules

## 🚀 Getting Started

### For Humans
1. Clone this repository
2. Navigate to the relevant kit folder
3. Fill in the blank templates (numbered files)
4. Provide the folder to your AI orchestrator agent

### For AI Agents
Read `00-START-HERE.md` in the relevant kit and follow the workflow exactly.

## 📁 Project Structure

```
CodeMaestro/
├── README.md
├── MVP_REPORT_TEMPLATE.md
├── CodeMaestro-DevKit-Generic/
│   ├── 00-START-HERE.md
│   ├── 01-REQUIREMENTS.md
│   ├── 02-ARCHITECTURE.md
│   ├── 03-DATA-MODEL.md
│   ├── 04-API-CONTRACT.openapi.yaml
│   ├── 05-FRONTEND-SPEC.md
│   ├── 06-UI-DESIGN-BRIEF-KOMBAI.md
│   ├── 07-AGENT-CONFIG.md
│   ├── 08-EXECUTION-PLAN.md
│   ├── 09-TESTING-QA.md
│   ├── 10-CI-CD.md
│   ├── 11-SECURITY-PRIVACY.md
│   ├── 12-OBSERVABILITY.md
│   ├── 13-DEFINITION-OF-DONE.md
│   ├── 14-RUNBOOKS.md
│   ├── 15-CHANGELOG.md
│   ├── 16-SECRETS-KEYS.md
│   ├── prompts/
│   └── profiles/
├── ProjectKit-CodeMaestro-VSCode-Wrapper/
│   ├── README.md
│   └── spec/
├── server/
│   └── mvp/
└── spec/
    ├── 17-GOLDEN-TASKS.md
    ├── 18-MVP-SCOPE.md
    ├── 19-REPLAY-RULES.md
    ├── 20-TOOL-ALLOWLIST.md
    └── AI_BUILD_PROMPT.md
```

## 🤖 Supported AI Agents

- Claude (Opus 4.5, Sonnet)
- Claude Code
- Gemini CLI
- Cursor Agent
- Other compatible AI coding assistants

## 📋 Key Specifications

| File | Purpose |
|------|---------|
| `00-START-HERE.md` | Entry point for AI agents |
| `01-REQUIREMENTS.md` | Project requirements |
| `02-ARCHITECTURE.md` | System architecture |
| `13-DEFINITION-OF-DONE.md` | Completion criteria |
| `AI_BUILD_PROMPT.md` | Build prompts for agents |

## 🔧 Development

### Prerequisites
- AI coding agent access (Claude, Gemini, etc.)
- Git for version control
- Code editor (VSCode recommended)

### Workflow
1. Define requirements in numbered spec files
2. Configure agent settings in `07-AGENT-CONFIG.md`
3. Run orchestrator with `00-START-HERE.md`
4. Monitor progress via `MVP_REPORT_TEMPLATE.md`

## 📝 License

See individual component folders for licensing information.

## 🗓️ Last Updated

December 13, 2025
