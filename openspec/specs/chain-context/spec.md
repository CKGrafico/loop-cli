## ADDED Requirements

### Requirement: Stdout capture for chain tasks

The system SHALL capture the stdout of every task in a chain (primary task and all chain tasks) into an in-memory buffer, in addition to streaming it to the log file. This capture SHALL be automatic and require no user configuration.

#### Scenario: Primary task stdout is captured

- **WHEN** a loop with a chain task runs its primary task
- **THEN** the primary task's stdout is both streamed to the log file AND captured as a string in memory

#### Scenario: Chain task stdout is captured

- **WHEN** a chain task executes as part of a chain
- **THEN** the chain task's stdout is both streamed to the log file AND captured as a string in memory

#### Scenario: Standalone loop without chains does not capture

- **WHEN** a loop runs with no chain tasks (onSuccessTaskId and onFailureTaskId are both null)
- **THEN** stdout is streamed to the log file only and no in-memory buffer is maintained

### Requirement: Stdout capture size cap

The system SHALL cap stdout capture at MAX_CONTEXT_STDOUT_BYTES (1MB). Output exceeding this cap SHALL be truncated to the first 1MB and a warning line SHALL be written to the log file.

#### Scenario: Stdout exceeds 1MB cap

- **WHEN** a task's stdout exceeds 1MB
- **THEN** only the first 1MB is captured into the context buffer
- **AND** a warning line is written to the log file indicating truncation

### Requirement: Context parsing rules

The system SHALL parse captured stdout into structured key-value pairs using the following precedence: (1) empty stdout produces no structured context update, (2) valid JSON object merges its keys into context, (3) valid JSON primitive (string/number from JSON.parse) is stored under the `output` key, (4) JSONL (multiple JSON objects on separate lines) merges each line's keys sequentially, (5) any other text is stored under the `output` key. After parsing, the system SHALL set `output` to stdout plus stderr from that Task, preserving named JSON keys such as `number`, `title`, and `body`.

#### Scenario: Empty stdout leaves context unchanged

- **WHEN** a task produces no stdout
- **THEN** the chain context is not modified

#### Scenario: JSON object stdout merges keys

- **WHEN** a task's stdout is `{"number": 123, "title": "Fix login"}`
- **THEN** `number` and `title` keys are merged into the chain context
- **AND** `output` contains that Task's stdout and stderr

#### Scenario: JSONL stdout merges each line

- **WHEN** a task's stdout is `{"number": 123}\n{"title": "Fix login"}`
- **THEN** both `number` and `title` keys are merged into the chain context

#### Scenario: Plain text stdout stored under output key

- **WHEN** a task's stdout is `123` (not valid JSON)
- **THEN** the value `123` is stored under the `output` key in chain context

#### Scenario: Plain text clobbers previous output key

- **WHEN** context.output is `"123"` and the next task outputs plain text `"done"`
- **THEN** context.output is overwritten to `"done"`

#### Scenario: Named JSON keys survive across tasks

- **WHEN** task 1 outputs `{"number": 123}` and task 2 outputs `{"refined": "story"}`
- **THEN** context contains both `number: 123` and `refined: "story"`

### Requirement: Template interpolation in chain task commands

The system SHALL interpolate `{{keyName}}` patterns in a chain task's `command` field and each entry in its `commandArgs` array, replacing the pattern with the corresponding value from the chain context, before spawning the process.

#### Scenario: Key exists in context

- **WHEN** chain context contains `{"number": 123}` and a chain task's command arg is `"{{number}}"`
- **THEN** the argument is replaced with `"123"` before spawning the process

#### Scenario: Key missing from context

- **WHEN** chain context does not contain a key named `missing` and a chain task's command arg is `"{{missing}}"`
- **THEN** the argument is replaced with an empty string

#### Scenario: No template patterns present

- **WHEN** a chain task's command and args contain no `{{key}}` patterns
- **THEN** the command and args are passed to the process unchanged

#### Scenario: Multiple keys in one argument

- **WHEN** chain context contains `{"a": 1, "b": 2}` and a chain task's command arg is `"{{a}}-{{b}}"`
- **THEN** the argument is replaced with `"1-2"`

### Requirement: Chain context lifecycle

The system SHALL initialize a fresh chain context object (`{}`) at the start of each loop iteration. The context SHALL accumulate values as tasks execute within that iteration. The context SHALL be discarded at the end of the iteration and SHALL NOT persist to disk, be exposed via IPC, or carry over to the next iteration.

#### Scenario: Context resets each iteration

- **WHEN** a loop runs two iterations and the first iteration sets context key `number` to 123
- **THEN** the second iteration starts with an empty context (no `number` key)

#### Scenario: Context is not persisted

- **WHEN** a loop iteration completes and context contains keys
- **THEN** none of the context keys appear in the persisted LoopMeta or any state file on disk
