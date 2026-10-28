import { describe, expect, test } from "bun:test";
import { parseState } from "../scan/parser";

// The settings block upstream's state-template.md defines (2.9+, with 2.11 changing
// the Guard Policy and collaborators defaults). The dashboard shows these verbatim;
// the test pins that "absent" stays undefined instead of becoming "".
const STATE = `## Project Information
- **Project**: demo
- **Project Type**: Brownfield
- **Project Type Source**: workspace scan
- **Scope**: mvp
- **Plan**: tailored plan
- **Worktree Path**: .worktrees/demo
- **Bolt Refs**: api,ui

## Scope Configuration
- **Depth**: Comprehensive
- **Test Strategy**: Minimal
- **Guard Policy**: strict (from scope enterprise)
- **Guards Off**: plan-approval (set by you)
- **Sensors**: off (from scope express)
- **Learnings**: on (from scope mvp)
- **Summary Confirmation**: off (set by a command)
- **Plan Approval**: on (from scope mvp)
- **Collaborators**: off (from scope mvp)
- **Review Override**: none

## Workspace State
- **Languages**: TypeScript, Python
- **Frameworks**: React
- **Build System**: bun

## Runtime State
- **Revision Count**: 2
- **Construction Execution**: serial
- **Unit Gate Rhythm**: per-stage
- **Construction Verification Command**: bun run verify

## Current Status
- **Lifecycle Phase**: CONSTRUCTION
- **Current Stage**: build-and-test
- **Next Stage**: ci-pipeline
- **Status**: Running
- **Last Updated**: 2026-01-02T10:00:00Z
`;

describe("parseState settings", () => {
  const state = parseState(STATE);

  test("reads every scope-configuration setting verbatim", () => {
    expect(state.depth).toBe("Comprehensive");
    expect(state.testStrategy).toBe("Minimal");
    expect(state.guardPolicy).toBe("strict (from scope enterprise)");
    expect(state.guardsOff).toBe("plan-approval (set by you)");
    expect(state.sensors).toBe("off (from scope express)");
    expect(state.learnings).toBe("on (from scope mvp)");
    expect(state.summaryConfirmation).toBe("off (set by a command)");
    expect(state.planApproval).toBe("on (from scope mvp)");
    expect(state.collaborators).toBe("off (from scope mvp)");
    expect(state.reviewOverride).toBe("none");
  });

  test("reads the plan, worktree and construction settings", () => {
    expect(state.plan).toBe("tailored plan");
    expect(state.projectTypeSource).toBe("workspace scan");
    expect(state.worktreePath).toBe(".worktrees/demo");
    expect(state.boltRefs).toBe("api,ui");
    expect(state.constructionExecution).toBe("serial");
    expect(state.unitGateRhythm).toBe("per-stage");
    expect(state.verificationCommand).toBe("bun run verify");
  });

  test("reads the detected workspace state", () => {
    expect(state.workspace).toEqual({
      languages: "TypeScript, Python",
      frameworks: "React",
      buildSystem: "bun",
    });
  });

  test("a legacy state reports absence instead of empty strings", () => {
    const legacy = parseState(`## Current Status
- **Lifecycle Phase**: IDEATION
- **Current Stage**: intent-capture
- **Status**: Running
`);
    expect(legacy.depth).toBeUndefined();
    expect(legacy.guardPolicy).toBeUndefined();
    expect(legacy.workspace).toBeUndefined();
  });
});
