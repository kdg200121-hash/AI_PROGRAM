---
tool: true
toolName: "CAD 선택 문자 순번 변경"
description: "AutoCAD에서 현재 선택한 TEXT/MTEXT 문자만 위에서 아래, 왼쪽에서 오른쪽 순서로 번호를 다시 붙입니다."
version: "1.0.0"
author: "김동건"
authorEmail: "kdg2947@hanmail.net"
sectionId: "cad"
program: "CAD"
risk: "modify"
deterministic: true
executionMode: "mcp"
requiredServers:
  - cad
settingsLayout:
  mode: "steps"
  sections:
    - id: numbering
      label: "순번 규칙"
      description: "선택한 문자에 적용할 접두어, 접미어, 시작 번호, 자릿수를 입력합니다."
      defaultOpen: true
    - id: safety
      label: "적용 확인"
      description: "미리보기로 바뀔 값을 확인한 뒤 실제 도면에 적용합니다."
      defaultOpen: true
settings:
  - id: prefix
    label: "앞文字"
    type: text
    required: false
    default: ""
    section: numbering
    preview: true
    description: "번호 앞에 붙일 문자입니다. 예: P-"
  - id: suffix
    label: "뒤文字"
    type: text
    required: false
    default: ""
    section: numbering
    preview: true
    description: "번호 뒤에 붙일 문자입니다."
  - id: start_number
    label: "시작 번호"
    type: number
    required: true
    default: 1
    min: 0
    step: 1
    section: numbering
    preview: true
    description: "첫 번째 선택 문자에 붙일 번호입니다."
  - id: padding
    label: "자릿수"
    type: number
    required: true
    default: 0
    min: 0
    max: 12
    step: 1
    section: numbering
    preview: true
    description: "0보다 크면 번호 앞에 0을 채웁니다. 예: 3이면 001 형식입니다."
actions:
  - id: preview
    label: "미리보기"
    runtimeAction: preview
    primary: true
    requiresPreview: false
    confirm: false
    description: "선택한 문자와 변경될 값을 표로 확인합니다. 도면은 바꾸지 않습니다."
  - id: apply
    label: "적용"
    runtimeAction: apply
    primary: true
    requiresPreview: true
    confirm: true
    description: "미리보기 결과를 확인한 뒤 선택한 TEXT/MTEXT 문자에만 번호를 적용합니다."
executionSteps:
  - id: numbering
    label: "규칙 입력"
    description: "접두어, 접미어, 시작 번호, 자릿수를 입력합니다."
    section: numbering
    state: active
  - id: preview
    label: "미리보기"
    description: "AutoCAD에서 선택한 TEXT/MTEXT가 어떤 값으로 바뀌는지 확인합니다."
    actionId: preview
    state: waiting
  - id: apply
    label: "적용"
    description: "확인한 결과를 현재 도면의 선택 문자에 적용합니다."
    actionId: apply
    state: waiting
mcpCommands:
  - server: cad
    command: cad.renumber_selected_text
    status: available
    runtimeAction: preview
    params:
      prefix: settings.prefix
      suffix: settings.suffix
      startNumber: settings.start_number
      padding: settings.padding
      apply: "false"
      confirmApply: "false"
    description: "현재 AutoCAD 선택 항목을 읽고 변경될 번호를 미리 계산합니다."
  - server: cad
    command: cad.renumber_selected_text
    status: available
    runtimeAction: apply
    params:
      prefix: settings.prefix
      suffix: settings.suffix
      startNumber: settings.start_number
      padding: settings.padding
      apply: "true"
      confirmApply: "true"
    description: "미리보기로 확인한 번호 규칙을 선택한 TEXT/MTEXT 문자에 적용합니다."
preflightChecks:
  - id: cad-connected
    label: "CAD MCP 연결"
    severity: error
    message: "CAD MCP 서버와 AutoCAD가 연결되어 있어야 합니다."
    blocksExecution: true
  - id: text-selection
    label: "문자 선택"
    severity: error
    message: "AutoCAD에서 TEXT 또는 MTEXT 객체를 먼저 선택해야 합니다."
    blocksExecution: true
  - id: preview-required
    label: "미리보기 확인"
    severity: warning
    message: "도면에 적용하기 전 미리보기 결과를 확인해야 합니다."
resultSchema:
  type: table
  fields:
    - id: index
      label: "순서"
      type: number
    - id: handle
      label: "핸들"
      type: text
    - id: layer
      label: "레이어"
      type: text
    - id: oldText
      label: "기존 문자"
      type: text
    - id: newText
      label: "변경 문자"
      type: text
    - id: applied
      label: "적용 여부"
      type: boolean
failurePolicy:
  partialSuccess: report
  rollback: manual
  log: true
inputs:
  - id: cad_selection
    label: "AutoCAD 선택 문자"
    type: selection
outputs:
  - id: renumbered_rows
    label: "순번 변경 결과"
    type: table
testCases:
  - name: "선택 없음"
    given: "AutoCAD에서 아무 객체도 선택하지 않고 미리보기를 실행합니다."
    expect: "selectionRequired 오류와 함께 도면을 변경하지 않습니다."
  - name: "미리보기"
    given: "TEXT/MTEXT를 선택하고 접두어 P-, 시작 번호 1, 자릿수 3으로 미리보기를 실행합니다."
    expect: "P-001부터 선택 문자 순서대로 변경될 값이 표로 표시되고 도면은 바뀌지 않습니다."
  - name: "적용"
    given: "미리보기 결과를 확인한 뒤 적용을 실행합니다."
    expect: "선택한 TEXT/MTEXT 문자만 변경되고 DWG 저장은 사용자가 직접 결정합니다."
learningLog:
  schemaVersion: "1"
  sourceSkill: "program-mcp-registrar"
  observedFriction:
    - "대량 도면 수정 도구와 달리 현재 선택 문자만 안전하게 바꾸는 작은 실행 도구가 필요했습니다."
  selectedOptions:
    - "전체 도면 검색 대신 AutoCAD 현재 선택 항목만 처리합니다."
    - "미리보기와 적용을 분리하고 적용은 확인 후에만 실행합니다."
  deferredImprovements:
    - "실제 선택 문자 미리보기와 적용은 사용자가 테스트용 DWG에서 명시적으로 확인한 뒤 활성화 범위를 넓힙니다."
---

# CAD 선택 문자 순번 변경

AutoCAD에서 현재 선택한 `TEXT` 또는 `MTEXT` 객체만 번호를 다시 붙이는 도구입니다.

## 사용 방법

1. AutoCAD에서 번호를 바꿀 문자 객체를 먼저 선택합니다.
2. 접두어, 접미어, 시작 번호, 자릿수를 입력합니다.
3. `미리보기`로 바뀔 값을 확인합니다.
4. 결과가 맞으면 `적용`을 실행합니다.

## 안전 기준

- 선택한 문자만 처리합니다.
- 도면 전체를 자동 검색하지 않습니다.
- 미리보기는 도면을 변경하지 않습니다.
- 적용 후에도 DWG 저장은 자동으로 하지 않습니다.
