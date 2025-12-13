# Orchestrator State Machine (MVP)

The orchestrator must be a strict state machine so it can be tested and replayed.

## States

* **IDLE**
* **PLANNING**
* **BUILDING (PLAYER)**
* **VERIFYING (COACH)**
* **WAITING_FOR_APPLY**
* **RUNNING_TOOL**
* **DONE**
* **FAILED**

## Transitions

1. **IDLE → PLANNING**
   - Trigger: `USER_PROMPT`
   - Output: `AGENT_MESSAGE(agent=planner, phase=planner)`

2. **PLANNING → BUILDING**
   - Trigger: planner output accepted
   - Output: `AGENT_MESSAGE(agent=player, phase=player)` + `PROPOSE_EDIT`

3. **BUILDING → WAITING_FOR_APPLY**
   - Trigger: `PROPOSE_EDIT` sent
   - Output: `STATUS(state=WAITING_FOR_APPLY)`

4. **WAITING_FOR_APPLY → VERIFYING**
   - Trigger: `APPLY_EDIT_RESULT(applied=true)`
   - Output: `AGENT_MESSAGE(agent=coach, phase=coach)`

5. **VERIFYING → RUNNING_TOOL**
   - Trigger: coach requests tool execution
   - Output: `RUN_TOOL` + tool execution logged in session store

6. **RUNNING_TOOL → VERIFYING**
   - Trigger: `TOOL_OUTPUT` received
   - Output: coach evaluates results

7. **VERIFYING → BUILDING**
   - Trigger: coach `FAIL` requires fixes
   - Output: `AGENT_MESSAGE(agent=coach, phase=coach, FAIL)` then player patch cycle

8. **VERIFYING → DONE**
   - Trigger: coach `PASS` with evidence AND Definition-of-Done satisfied for the task
   - Output: `STATUS(state=DONE)` + final summary

## Fresh Context Summary Rule

At the end of each state, update `summary.md`:

* current requirement/task
* files changed so far
* last test command + result
* next actions

This summary is what gets fed to agents as context next loop.