import React from "react";
import { Box, Text, useInput } from "ink";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { useInject } from "../../shared/hooks/useInject.js";
import { TYPES } from "../../shared/services/types.js";
import type { LoopService } from "../../shared/services/types.js";
import { parseDuration } from "../../duration.js";
import type { LoopOptions } from "../../types.js";

const EXAMPLES: Array<{ label: string; interval: string; command: string; args: string[] }> = [
  { label: "Run tests every 30m", interval: "30m", command: "npm", args: ["test"] },
  { label: "Watch for GitHub issues every 5m", interval: "5m", command: "gh", args: ["issue", "list"] },
  { label: "Sync deps every hour", interval: "1h", command: "npm", args: ["outdated"] },
];

export function WelcomeScreen(props: {
  onCreateEmpty: () => void;
  onCreateLoop: () => void;
  onRefresh: () => Promise<void>;
}): React.ReactNode {
  const loopService = useInject<LoopService>(TYPES.LoopService);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [creating, setCreating] = React.useState<string | null>(null);
  const items = [...EXAMPLES.map((e) => e.label), "Create empty loop"];

  useInput((_input, key) => {
    if (_input.includes("[<")) return;
    if (creating) return;
    if (key.upArrow) {
      setSelectedIndex((i) => i <= 0 ? items.length - 1 : i - 1);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((i) => i >= items.length - 1 ? 0 : i + 1);
      return;
    }
    if (key.return) {
      if (selectedIndex === EXAMPLES.length) {
        props.onCreateEmpty();
        return;
      }
      const example = EXAMPLES[selectedIndex];
      if (example) {
        setCreating(example.label);
        const options: LoopOptions = {
          interval: parseDuration(example.interval),
          taskId: null,
          command: example.command,
          commandArgs: example.args,
          cwd: "",
          immediate: false,
          maxRuns: null,
          verbose: false,
          description: example.label,
          projectId: "default",
          offset: null,
        };
        loopService.create(options, example.interval)
          .then(() => props.onRefresh())
          .then(() => props.onCreateLoop())
          .catch(() => setCreating(null));
      }
      return;
    }
    if (_input === "n") {
      props.onCreateEmpty();
      return;
    }
    if (_input === "h") {
      return;
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <Box borderStyle="round" borderColor={theme.accent.brand} backgroundColor={theme.bg.surface} paddingX={4} paddingY={1} flexDirection="column">
        <Text color={theme.accent.brand} bold>{"\n"}Welcome to loop-task!{"\n"}</Text>
        <Text color={theme.text.secondary}>Loop engineering: define a purpose,</Text>
        <Text color={theme.text.secondary}>give it an interval, let it iterate.{"\n"}</Text>
        <Text color={theme.text.muted}>No loops yet. Here are some examples:{"\n"}</Text>
        {items.map((label, i) => {
          const isSelected = i === selectedIndex;
          const bg = isSelected ? theme.bg.active : undefined;
          const fg = isSelected ? theme.text.inverse : theme.text.primary;
          const prefix = isSelected ? "\u203a " : "  ";
          return (
            <Box key={label} backgroundColor={bg}>
              <Text color={fg}>{prefix}{label}</Text>
            </Box>
          );
        })}
        <Text color={theme.text.muted}>{"\n"}or press 'n' to create a custom loop</Text>
        <Text color={theme.text.muted}>press 'h' for keyboard shortcuts (from main view)</Text>
        {creating ? (
          <Text color={theme.accent.brand}>{"\n"}Creating: {creating}...</Text>
        ) : null}
      </Box>
    </Box>
  );
}
