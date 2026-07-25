import React from "react";
import { Box, Text, useInput } from "ink";
import type { LoopMeta, Project } from "../../types.js";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { t } from "../../shared/i18n/index.js";

export function ProjectsModal(props: {
  projects: Project[];
  loops: LoopMeta[];
  currentProjectId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}): React.ReactNode {
  const { projects, loops, currentProjectId, onSelect, onClose } = props;
  const [selectedIndex, setSelectedIndex] = React.useState(() => {
    const allIdx = projects.findIndex((p) => p.id === "all");
    if (allIdx >= 0) return allIdx;
    const currentIdx = projects.findIndex((p) => p.id === currentProjectId);
    return currentIdx >= 0 ? currentIdx : 0;
  });

  useInput((input, key) => {
    if (input.includes("[<")) return;
    if (key.upArrow) {
      setSelectedIndex((i) => i <= 0 ? projects.length - 1 : i - 1);
    } else if (key.downArrow) {
      setSelectedIndex((i) => i >= projects.length - 1 ? 0 : i + 1);
    } else if (key.return) {
      const project = projects[selectedIndex];
      if (project) onSelect(project.id);
    } else if (key.escape) {
      onClose();
    }
  });

  const loopCount = (pid: string) =>
    loops.filter((l) => (l.projectId ?? "default") === pid).length;

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" width="100%">
      <Box
        borderStyle="round"
        borderColor={theme.accent.brand}
        backgroundColor={theme.bg.elevated}
        flexDirection="column"
        paddingX={2}
        paddingY={1}
        minWidth={40}
        maxWidth={60}
      >
        <Text color={theme.accent.brand} bold>{t("project.filterTitle")}</Text>
        {projects.map((project, i) => {
          const isSelected = i === selectedIndex;
          const isActive = project.id === currentProjectId;
          const prefix = isSelected ? "\u203a " : "  ";
          const bg = isSelected ? theme.bg.active : undefined;
          const fg = isSelected ? theme.text.inverse : isActive ? theme.accent.brand : theme.text.primary;
          return (
            <Box key={project.id} backgroundColor={bg}>
              <Text color={fg}>
                {prefix}
                <Text color={project.color ?? theme.text.primary}>{"\u25cf "}</Text>
                {project.name} <Text color={theme.text.muted}>({loopCount(project.id)})</Text>
              </Text>
            </Box>
          );
        })}
        <Text color={theme.text.muted}>{"\n"}{t("board.logModalEscClose")}</Text>
      </Box>
    </Box>
  );
}
