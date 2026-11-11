# Campus Activities agent team

This directory defines the seven agents used to plan and implement work in the Campus Activities repository. The agents are prompt-oriented role contracts: an orchestrator can load the relevant file as the agent's system instructions and provide the task plus repository context as input.

## Instructions for use

Open an agent and assign it the role of Architect. Use the Architect to discuss and plan feature implementations. When you feel that a satisfactory plan has been reached, tell the Architect to implement the changes; the Architect hands the approved implementation brief to the Orchestrator, which will divide the task and assign steps to specialized agents. The Architect creates the acceptance criteria, and each specialist's completed work will be verified by the Testing/Quality Engineer against each acceptance criterion before being returned to the Orchestrator. Upon conclusion of the main task, the Orchestrator will provide a paragraph summary of work for each agent.

The Architect is the only agent intended to have direct input from and conversation with the user.

## Team

| Agent title | Primary responsibility | Typical phase |
| --- | --- | --- |
| Architect | User-facing discovery, requirements, and high-level design | Before implementation |
| Orchestrator | Task decomposition, assignment, dependency management, and reporting | Throughout |
| Backend/API Engineer | Express routes, controllers, middleware, and server-side validation | Implementation |
| PostgreSQL Database Engineer | Schema, migrations, queries, constraints, and database safety | Design and implementation |
| Frontend/UI Engineer | Static pages, browser JavaScript, accessibility, and responsive UI | Implementation |
| Integration Engineer | API/UI contracts and end-to-end feature wiring | After parallel work |
| Testing/Quality Engineer | Automated tests, regression coverage, lint, and acceptance verification | Throughout and final |

## Recommended execution flow

```text
User <-> Architect -> Orchestrator
                         |-> Database Engineer -> QA
                         |-> Backend/API Engineer -> QA
                         |-> Frontend/UI Engineer -> QA
                         `-> Integration Engineer -> QA
                                                   |
                                      reject -> owner -> QA (repeat)
                                                   |
                                                 accept
                                                   v
                                             Orchestrator
                                                   |
                                                   v
                                             Architect -> User
```

The Orchestrator should only activate specialists relevant to the task. For a backend-only change, the frontend and integration agents may be review-only or skipped. Every implementation specialist must send its work to the Testing/Quality Engineer before sending a completion handoff to the Orchestrator. The Testing/Quality Engineer remains the gate for every code change.

The Architect is the only role that communicates with the user. The Orchestrator and specialists communicate through internal handoffs; the Orchestrator's final report is returned to the Architect for presentation to the user.

## Shared handoff requirements

Every internal agent handoff must return:

1. **Status:** `complete`, `partial`, `blocked`, or `not applicable`.
2. **Summary:** what was changed or decided.
3. **Files:** files read or changed, with important symbols where useful.
4. **Verification:** commands run and their results.
5. **Handoff:** assumptions, risks, follow-up work, or decisions needed.

Agents must follow the repository's `AGENTS.md`, preserve unrelated user changes, avoid secrets, and keep work within the task scope. The Orchestrator owns final sequencing and reporting; it does not silently overwrite specialist decisions.

Each role file also defines its role-specific **Inputs** and **Outputs**. Inputs describe what must be available before the role starts; outputs describe what the role must produce for the next role in the workflow.

## Mandatory specialist QA gate

The Backend/API Engineer, PostgreSQL Database Engineer, Frontend/UI Engineer, and Integration Engineer must follow this order:

1. Complete the assigned work and prepare the required handoff.
2. Send the work, changed files, acceptance criteria, and verification evidence to the Testing/Quality Engineer.
3. If QA rejects the work, apply the requested fixes and resubmit to QA.
4. Repeat until QA returns `accepted`.
5. Only then send the completion handoff to the Orchestrator.

The Orchestrator must reject any specialist handoff that does not include QA's acceptance. QA feedback is not optional or advisory for implementation work.
