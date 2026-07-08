---
tool: true
name: "CAD 도면번호 일괄 순번 변경"
toolName: "CAD 도면번호 일괄 순번 변경"
sectionId: "cad"
program: "CAD"
version: "1.0.0"
author: "Unknown"
description: "여러 DWG에서 도곽 기준 위치의 Text/MText 도면번호를 순서대로 일괄 변경합니다."
risk: "bulk-modify"
deterministic: true
executionMode: "mcp"
requiredServers:
  - cad
mcpCommands:
  - server: cad
    command: cad.open_dwg
    status: planned
    params:
      filePath: settings.dwg_files.current.file_path
      openMode: "write"
  - server: cad
    command: cad.detect_title_block_candidates
    status: planned
    params:
      filePath: settings.dwg_files.first.file_path
      objectTypes:
        - block_reference
      rankBy:
        - repeated_count
        - bounding_box_size
        - paper_space_priority
  - server: cad
    command: cad.select_title_block_candidate
    status: planned
    params:
      candidateId: settings.selected_title_block_candidate_id
      fallbackManualSelection: true
  - server: cad
    command: cad.find_text_in_title_block
    status: planned
    params:
      titleBlockId: runtime.selected_title_block_id
      textTypes:
        - text
        - mtext
      contains: settings.reference_search_text
      preferredTextHandle: settings.selected_reference_text_handle
  - server: cad
    command: cad.apply_relative_text_position_to_drawings
    status: planned
    params:
      dwgFiles: settings.dwg_files
      relativePosition: previous.result.relative_position
      tolerance: 10
      titleBlockSortOrder: top_left_to_bottom_right
  - server: cad
    command: cad.update_text_values
    status: planned
    params:
      targets: previous.result.text_targets
      numbering:
        prefix: settings.number_prefix
        startNumber: settings.start_number
        digitCount: settings.digit_count
        increment: 1
      previewOnly: 'runtime.action == "preview"'
  - server: cad
    command: cad.save_dwg
    status: planned
    condition: 'runtime.action == "apply"'
    params:
      filePath: settings.dwg_files.current.file_path
      backupPolicy: none
      requireFinalConfirmation: true
preflightChecks:
  - id: cad_connected
    label: "CAD MCP 서버 연결 확인"
    severity: error
    message: "CAD MCP 서버가 연결되어 있어야 합니다."
    blocksExecution: true
  - id: dwg_files_selected
    label: "DWG 파일 선택 확인"
    severity: error
    message: "수정할 DWG 파일을 1개 이상 선택해야 합니다."
    blocksExecution: true
  - id: writable_dwg_files
    label: "DWG 쓰기 권한 확인"
    severity: error
    message: "선택한 모든 DWG 파일이 쓰기 가능한 상태여야 합니다."
    blocksExecution: true
  - id: title_block_candidate_selected
    label: "도곽 후보 선택 확인"
    severity: error
    message: "첫 DWG에서 사용할 도곽 후보를 선택해야 합니다."
    blocksExecution: true
  - id: reference_text_found
    label: "기준 문자 위치 확인"
    severity: error
    message: "첫 DWG의 도곽 내부에서 기준 검색 문자를 포함한 Text/MText를 찾아야 합니다."
    blocksExecution: true
  - id: preview_generated
    label: "변경 미리보기 확인"
    severity: error
    message: "원본 수정 전에 변경 전/후 미리보기를 생성해야 합니다."
    blocksExecution: true
  - id: original_modify_confirmation
    label: "원본 직접 수정 확인"
    severity: error
    message: "백업 없이 원본 DWG를 직접 수정한다는 최종 확인이 필요합니다."
    blocksExecution: true
resultSchema:
  type: table
  fields:
    - id: file_path
      label: "DWG 파일"
      type: text
    - id: file_title_block_count
      label: "파일별 도곽 수"
      type: number
    - id: file_number_range
      label: "파일별 번호 범위"
      type: text
    - id: title_block_index
      label: "도곽 순서"
      type: number
    - id: old_drawing_number
      label: "기존 도면번호"
      type: text
    - id: new_drawing_number
      label: "새 도면번호"
      type: text
    - id: text_handle
      label: "수정된 Text/MText 핸들"
      type: text
    - id: status
      label: "상태"
      type: text
failurePolicy:
  partialSuccess: "report"
  rollback: "none"
  log: true
settingsLayout:
  mode: "sections"
  sections:
    - id: input
      label: "설정 입력"
      defaultOpen: true
    - id: candidate
      label: "후보 확인"
      defaultOpen: true
executionSteps:
  - id: input
    label: "설정 입력"
    description: "수정할 DWG 파일을 직접 선택하고, 기준 검색 문자와 새 번호 규칙을 입력합니다."
    section: input
    state: active
  - id: preview
    label: "분석 미리보기"
    description: "원본을 저장하지 않고 도곽 수, 번호 범위, 변경 전/후 목록을 계산합니다."
    actionId: preview
    state: waiting
  - id: candidate
    label: "후보 확인"
    description: "첫 DWG에서 추정한 도곽 후보와 기준 문자 위치가 맞는지 확인합니다."
    section: candidate
    state: waiting
  - id: apply
    label: "원본에 적용"
    description: "미리보기 결과가 맞으면 최종 확인 후 원본 DWG에 저장합니다."
    actionId: apply
    state: waiting
actions:
  - id: preview
    label: "분석 미리보기"
    runtimeAction: preview
    primary: true
    description: "원본 DWG를 수정하지 않고 도곽 후보, 도면번호 위치, 파일별 번호 범위를 계산합니다."
  - id: apply
    label: "원본에 적용"
    runtimeAction: apply
    requiresPreview: true
    confirm: true
    description: "미리보기 결과 확인 후 원본 DWG에 변경된 도면번호를 저장합니다."
learningLog:
  schemaVersion: "1"
  sourceSkill: "mcp-tool-builder"
  observedFriction:
    - "DWG 파일 목록은 텍스트 행이 아니라 파일 선택으로 추가되어야 했다."
    - "도곽 수와 번호 범위는 사용자 설정값이 아니라 미리보기 후 표시되는 파생 결과였다."
    - "미리보기와 원본 적용은 체크박스가 아니라 별도 실행 action이어야 했다."
  suggestedOptions:
    - "도곽 후보는 첫 DWG에서 추정 리스트를 보여주고 필요 시 직접 선택하는 방식으로 정리했다."
  selectedOptions:
    - "여러 DWG 파일 직접 선택, 목록 순서대로 처리, Text/MText 기준 문자 위치 인식"
  deferredImprovements:
    - "실제 CAD MCP 브리지에서 planned 명령 구현 및 AutoCAD 실도면 검증 필요"
testCases:
  - name: "파일 목록 순서와 도곽 위치 순서대로 순번 부여"
    given: "DWG 2개, 각 파일에 같은 도곽 블록 2개, 기준 검색 문자 P-를 포함한 Text/MText가 각 도곽에 1개씩 있음"
    settings: "파일 순서: A.dwg, B.dwg / 기준 검색 문자 P- / 접두어 P- / 시작번호 101 / 자리수 3"
    expect: "A.dwg의 도곽 1,2가 P-101, P-102로 바뀌고 B.dwg의 도곽 1,2가 P-103, P-104로 바뀐다."
  - name: "기준 문자를 찾지 못하면 실행 중단"
    given: "첫 DWG의 선택 도곽 안에 P-를 포함한 Text/MText가 없음"
    settings: "기준 검색 문자 P-"
    expect: "원본 DWG를 수정하지 않고 기준 문자 위치 확인 오류를 표시한다."
inputs:
  - id: dwg_files
    label: "DWG 파일 목록"
    type: file
outputs:
  - id: file_summaries
    label: "파일별 미리보기 요약"
    type: table
  - id: changed_rows
    label: "변경 결과 목록"
    type: table
  - id: log
    label: "실행 로그"
    type: log
settings:
  - id: dwg_files
    label: "DWG 파일 목록"
    type: repeatable-list
    itemType: file
    valueKey: file_path
    accept: ".dwg,.dxf"
    showItemSummary: true
    summaryCountKey: title_block_count
    summaryRangeKey: number_range
    pendingSummaryLabel: "미분석"
    pendingRangeLabel: "미리보기 필요"
    required: true
    default: []
    section: input
    preview: true
    description: "항목 추가를 누르면 DWG 파일 선택창을 열고, 선택한 도면 경로를 목록 값으로 저장합니다. 불러온 뒤 삭제와 위/아래 이동으로 처리 순서를 조정합니다. 미리보기 후 각 파일 행에 인식 도곽 수와 배정 번호 범위를 표시합니다."
    validationMessage: "DWG 파일을 1개 이상 선택하세요."
  - id: reference_search_text
    label: "기준 검색 문자"
    type: text
    required: true
    default: "P-"
    section: input
    preview: true
    placeholder: "예: P-"
    description: "첫 DWG의 선택 도곽 내부에서 이 문자를 포함한 Text/MText를 찾아 도면번호 위치로 인식합니다."
    validationMessage: "기준 검색 문자를 입력하세요."
  - id: number_prefix
    label: "접두어"
    type: text
    required: true
    default: "P-"
    section: input
    preview: true
    description: "새 도면번호 앞에 붙일 문자입니다."
  - id: start_number
    label: "시작번호"
    type: number
    required: true
    default: 101
    min: 0
    step: 1
    section: input
    preview: true
    description: "첫 번째 도곽에 부여할 시작 번호입니다."
  - id: digit_count
    label: "번호 자리수"
    type: number
    required: true
    default: 3
    min: 1
    max: 12
    step: 1
    section: input
    preview: true
    description: "번호를 몇 자리로 맞출지 지정합니다. 예: 3이면 P-001 형식입니다."
  - id: selected_title_block_candidate_id
    label: "선택한 도곽 후보"
    type: object-selection
    required: true
    default: ""
    section: candidate
    preview: true
    description: "분석 미리보기에서 나온 도곽 후보 중 실제 도곽으로 사용할 항목입니다. 후보가 틀리면 CAD에서 직접 선택합니다."
    validationMessage: "사용할 도곽 후보를 선택하세요."
  - id: selected_reference_text_handle
    label: "선택한 기준 문자"
    type: object-selection
    required: true
    default: ""
    section: candidate
    preview: true
    description: "첫 DWG의 도곽 안에서 도면번호 위치 기준으로 사용할 Text/MText입니다."
    validationMessage: "도면번호 위치 기준 문자를 선택하세요."
---

# CAD 도면번호 일괄 순번 변경

## 목적

여러 DWG 파일에서 도곽을 기준으로 같은 위치에 있는 Text/MText 도면번호를 찾아, 사용자가 정한 파일 순서와 도곽 위치 순서대로 새 도면번호를 일괄 부여합니다.

이 툴은 도면번호가 블록 속성이 아니라 일반 `Text` 또는 `MText`로 들어있는 CAD 도면을 대상으로 합니다.

## 실행 단계

### 1. 설정 입력

사용자가 수정할 DWG 파일을 직접 선택합니다. 불러온 목록에서 파일을 추가하거나 잘못 불러온 파일을 삭제할 수 있고, 위로/아래로 이동해서 처리 순서를 직접 정합니다.

화면에 보이는 파일 목록 순서가 처리 순서입니다. 기준 검색 문자, 접두어, 시작번호, 번호 자리수도 이 단계에서 입력합니다.

미리보기 전에는 각 파일 행의 분석 상태를 `미분석`으로 표시합니다. 도곽 후보와 기준 문자 위치가 확인되면 파일별로 인식한 도곽 수와 해당 파일에 배정될 도면번호 범위를 계산해 같은 행에 표시합니다. 예: `도곽 2개`, `P-101~P-102`.

### 2. 분석 미리보기

`분석 미리보기`는 원본 DWG를 저장하지 않고 다음 정보를 계산합니다.

첫 번째 DWG에서 반복되는 블록, 블록 크기, Paper Space/Model Space 위치를 기준으로 도곽으로 추정되는 블록 후보를 표시합니다.

사용자가 `P-` 같은 기준 검색 문자를 입력하면, 첫 DWG의 선택 도곽 내부에서 그 문자를 포함한 `Text` 또는 `MText`를 찾습니다.

찾은 텍스트의 도곽 기준 상대 위치를 저장하고, 다른 DWG와 다른 도곽에서는 같은 상대 위치 주변의 Text/MText를 도면번호로 인식합니다.

### 3. 후보 확인

사용자는 첫 DWG에서 추정된 도곽 후보와 기준 문자 위치가 맞는지 확인합니다. 후보가 틀렸을 때는 첫 DWG에서 도곽을 직접 선택할 수 있습니다.

### 4. 원본에 적용

새 도면번호는 다음 규칙으로 생성합니다.

- 접두어: 예 `P-`
- 시작번호: 예 `101`
- 번호 자리수: 예 `3`

예를 들어 접두어가 `P-`, 시작번호가 `101`, 자리수가 `3`이면 `P-101`, `P-102`, `P-103` 순서로 생성됩니다.

한 DWG 안에 도곽이 여러 개 있으면 좌상단에서 우하단 방향으로 순번을 부여합니다. 다음 DWG로 넘어가도 번호는 이어서 증가합니다.

사용자가 미리보기 결과와 원본 DWG 직접 수정 경고를 확인하면 `원본에 적용` action이 실제 저장을 수행합니다.

현재 설계는 백업 없이 원본 DWG를 직접 수정합니다.

## 단계별 설정

설정 schema는 frontmatter의 `settings`에 정의되어 있습니다. 사용자에게 보이는 핵심 설정은 다음과 같습니다.

- DWG 파일 목록: `항목 추가`를 누르면 DWG 파일 선택창을 열고, 선택한 도면 경로를 목록 값으로 저장합니다. 불러온 뒤 삭제/정렬합니다.
- 파일별 미리보기: 도곽 수와 해당 도면에 들어갈 번호 범위는 사용자가 입력하지 않고 미리보기/분석 결과로 표시합니다.
- 기준 검색 문자: `P-` 같은 문자로 첫 DWG 도곽 내부의 도면번호 위치를 찾습니다.
- 새 도면번호 규칙: 접두어, 시작번호, 자리수.
- 후보 확인: 분석 미리보기 후 선택한 도곽 후보와 기준 문자 Text/MText를 확정합니다. 이 단계는 설정 입력과 별도 화면으로 표시합니다.
- 실행 전 요약, 점검, 검증, 테스트 요약은 설정창 하단의 검토 아이콘을 눌렀을 때만 펼쳐서 봅니다.

다음 값은 사용자가 고르는 설정이 아니라 고정 실행 규칙입니다.

- 검색 대상 문자: `Text`, `MText`
- 파일 처리 순서: 화면 목록 순서
- 도곽 정렬 순서: 좌상단에서 우하단
- 상대 위치 허용 오차: `10`
- 번호 증가값: `1`
- 백업 정책: 백업 없이 원본 직접 수정
- 최종 확인: `원본에 적용` action 실행 전 필수

HTML 설정창 목업은 `outputs/cad-drawing-number-batch-renumber-settings-mockup.html`에 있습니다.

## MCP 명령 계획

아직 구현/확인 필요: 아래 MCP 명령은 실행 설계를 위한 planned 명령입니다. 실제 CAD MCP 서버에 같은 명령이 있는지 확인하거나 브리지에서 구현해야 합니다.

- Required servers: `cad`
- Command sequence:
  1. `cad.open_dwg`
  2. `cad.detect_title_block_candidates`
  3. `cad.select_title_block_candidate`
  4. `cad.find_text_in_title_block`
  5. `cad.apply_relative_text_position_to_drawings`
  6. `cad.update_text_values`
  7. `cad.save_dwg`
- Parameter mapping:
  - `settings.dwg_files` → 처리할 DWG 파일 목록
  - `settings.reference_search_text` → 도면번호 위치 검색 문자
  - 도곽 내부 순번 기준 → 고정값 `top_left_to_bottom_right`
  - `settings.number_prefix`, `settings.start_number`, `settings.digit_count`와 고정 증가값 `1` → 새 도면번호 생성 규칙
  - `runtime.action == "preview"` → 원본 저장 없이 분석 미리보기
  - `runtime.action == "apply"` → 최종 확인 후 원본 저장
  - 백업 정책과 최종 확인 → 고정 안전 정책
- Fallback/manual step:
  - 도곽 후보가 부정확하면 사용자가 첫 DWG에서 도곽을 직접 선택합니다.
  - 기준 검색 문자가 여러 Text/MText에서 발견되면 미리보기에서 사용자가 대상 텍스트를 확정해야 합니다.

## 입력 포트

- `dwg_files`: 수정할 DWG 파일 목록입니다.

Custom Flow에서 사용할 경우 `dwg_files`를 이전 노드의 파일 목록 출력과 연결할 수 있습니다. 단, 파일 순서는 결과에 직접 영향을 주므로 실행 전 목록 순서를 사용자에게 다시 보여줘야 합니다.

## 출력 포트

- `changed_rows`: 파일별, 도곽별 변경 결과 표입니다.
- `file_summaries`: 파일별 인식 도곽 수, 시작 번호, 끝 번호, 상태를 담은 미리보기 요약 표입니다.
- `log`: 실행 로그입니다.

## 실행 조건

- CAD MCP 서버가 연결되어 있어야 합니다.
- 선택한 모든 DWG 파일이 존재하고 쓰기 가능해야 합니다.
- 첫 DWG에서 도곽 후보를 선택해야 합니다.
- 첫 DWG의 선택 도곽 내부에서 기준 검색 문자를 포함한 Text/MText를 찾을 수 있어야 합니다.
- 원본 수정 전 변경 미리보기가 생성되어야 합니다.
- 백업 없이 원본 DWG 직접 수정한다는 최종 확인이 필요합니다.

## 주의사항

- 이 툴은 여러 DWG 파일의 원본 데이터를 직접 수정하는 대량 수정 도구입니다.
- 현재 백업 정책은 `백업 없이 원본 바로 수정`입니다. 실무 적용 전 백업 옵션을 추가하는 것이 안전합니다.
- 기준 검색 문자(`P-` 등)가 도곽 내부 여러 텍스트에 동시에 포함되면 잘못된 텍스트를 도면번호로 인식할 수 있습니다.
- 도곽 크기, 회전, 축척, 좌표계가 파일마다 크게 다르면 상대 위치 인식이 실패할 수 있습니다.
- planned MCP 명령이 실제 CAD 브리지에 구현되기 전까지는 실행 가능한 도구가 아니라 실행 사양 초안입니다.

## 예상 결과

성공 시 결과 표에는 다음 정보가 표시됩니다.

- 수정한 DWG 파일 경로
- 파일별 도곽 수
- 파일별 새 도면번호 범위
- 도곽 순서
- 기존 도면번호
- 새 도면번호
- 수정된 Text/MText 핸들
- 성공/실패 상태

예시:

| DWG 파일 | 파일별 도곽 수 | 파일별 번호 범위 | 도곽 | 기존 도면번호 | 새 도면번호 | 상태 |
|---|---:|---|---:|---|---|---|
| A-101_평면도.dwg | 2 | P-101~P-102 | 1 | P-001 | P-101 | 성공 |
| A-101_평면도.dwg | 2 | P-101~P-102 | 2 | P-002 | P-102 | 성공 |
| A-102_평면도.dwg | 1 | P-103~P-103 | 1 | P-003 | P-103 | 성공 |

## 실패 처리

- 입력 누락: DWG 파일이 없거나 기준 검색 문자가 비어 있으면 실행하지 않습니다.
- MCP 미연결: CAD MCP 서버 연결 오류를 표시하고 실행하지 않습니다.
- 도곽 후보 없음: 후보를 표시하지 못하면 사용자가 직접 도곽을 선택하도록 안내합니다.
- 기준 문자 없음: 첫 DWG에서 기준 문자를 찾지 못하면 원본을 수정하지 않고 중단합니다.
- 일부 파일 실패: 성공한 파일과 실패한 파일을 로그에 나누어 표시합니다. 현재 rollback은 없습니다.
- 저장 실패: 해당 파일의 실패 상태를 기록하고 다음 파일 처리는 정책에 따라 계속하거나 중단합니다. 기본 정책은 실패 보고입니다.

## 테스트 예시

### 기본 순번 변경

- 입력: `A.dwg`, `B.dwg`
- 설정: 기준 검색 문자 `P-`, 접두어 `P-`, 시작번호 `101`, 자리수 `3`
- 예상 결과: `A.dwg`의 도곽 1,2가 `P-101`, `P-102`로 바뀌고 `B.dwg`의 도곽 1,2가 `P-103`, `P-104`로 바뀝니다.

### 기준 문자 미발견

- 입력: 첫 DWG 도곽 안에 `P-`를 포함한 Text/MText가 없음
- 설정: 기준 검색 문자 `P-`
- 예상 결과: 원본 DWG를 수정하지 않고 기준 문자 위치 확인 오류를 표시합니다.
