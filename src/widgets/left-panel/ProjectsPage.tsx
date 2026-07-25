import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Project, LoopMeta } from "../../types.js";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { FocusableButton } from "../../shared/ui/FocusableButton.js";
import { t } from "../../shared/i18n/index.js";
import { useInject } from "../../shared/hooks/useInject.js";
import { TYPES } from "../../shared/services/types.js";
import type { ProjectService } from "../../shared/services/types.js";
import { DeleteConfirm, ListFocusWrapper, loopCountFor } from "./ProjectsPageParts.js";

interface ProjectsPageProps {
  projects: Project[];
  loops: LoopMeta[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onOpenCreate: (trigger: (() => void) | null) => void;
  onToast: (msg: string) => void;
  onNavigateCreate?: () => void;
  onNavigateEdit?: (project: Project) => void;
}

type SubModal = "none" | "delete";

export function ProjectsPage(props: ProjectsPageProps): React.ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [subModal, setSubModal] = useState<SubModal>("none");
  const projectService = useInject<ProjectService>(TYPES.ProjectService);

  const defaultProject = props.projects.find((p) => p.isDefault) ?? null;
  const defaultProjectId = defaultProject?.id ?? null;
  const knownProjectIds = new Set(props.projects.map((p) => p.id));

  const selected = props.projects[selectedIndex];
  const loopCount = selected
    ? loopCountFor(props.loops, selected.id, defaultProjectId, knownProjectIds)
    : 0;

  useInput((input, key) => {
    if (subModal !== "none") return;
    if (input.includes("[<")) return;

    if (key.escape) {
      props.onClose();
      return;
    }

    if (input === "n") {
      if (props.onNavigateCreate) {
        props.onNavigateCreate();
      }
      return;
    }

    if (input === "e" && selected) {
      if (props.onNavigateEdit) {
        props.onNavigateEdit(selected);
      }
      return;
    }

    if (input === "d" && selected) {
      setSubModal("delete");
      return;
    }
  });

  async function handleDelete(): Promise<void> {
    if (!selected) return;
    try {
      await projectService.delete(selected.id);
      props.onToast(t("project.toastDeleted", { name: selected.name }));
      await props.onRefresh();
      setSubModal("none");
      setSelectedIndex(0);
    } catch (e) {
      props.onToast((e as Error).message);
    }
  }

  if (subModal === "delete" && selected) {
    return (
      <DeleteConfirm
        project={selected}
        loopCount={loopCount}
        onConfirm={handleDelete}
        onCancel={() => setSubModal("none")}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Box width="40%" flexDirection="column">
          <Box borderStyle="single" borderColor={theme.accent.project} paddingX={1}>
            <Text color={theme.accent.project} bold>
              {t("project.projectsTitle")}
            </Text>
          </Box>

          {props.projects.length === 0 ? (
            <Box paddingX={1}>
              <Text color={theme.text.muted}>{t("project.noLoops")}</Text>
            </Box>
          ) : (
            <ListFocusWrapper
              projects={props.projects}
              loops={props.loops}
              defaultProjectId={defaultProjectId}
              knownProjectIds={knownProjectIds}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onActivate={(idx) => {
                setSelectedIndex(idx);
                if (props.onNavigateEdit) {
                  const p = props.projects[idx];
                  if (p) props.onNavigateEdit(p);
                }
              }}
            >
              {null}
            </ListFocusWrapper>
          )}
        </Box>

        <Box flexGrow={1} flexDirection="column" marginLeft={1}>
          {selected ? (
            <React.Fragment>
              <Box borderStyle="single" borderColor={theme.accent.brand} padding={1} flexDirection="column">
                <Box marginBottom={1}>
                  <Text color={selected.color} bold>
                    {"\u25CF"}
                  </Text>
                  <Text color={theme.text.primary} bold>
                    {" " + selected.name}
                  </Text>
                </Box>

                <Box>
                  <Text color={theme.text.muted}>ID:       </Text>
                  <Text color={theme.text.secondary}>{selected.id}</Text>
                </Box>

                <Box>
                  <Text color={theme.text.muted}>Created:  </Text>
                  <Text color={theme.text.secondary}>{selected.createdAt}</Text>
                </Box>

                <Box>
                  <Text color={theme.text.muted}>Loops:    </Text>
                  <Text color={theme.text.secondary}>
                    {t("project.loopCount", { count: loopCount })}
                  </Text>
                </Box>

                {selected.directory ? (
                  <Box>
                    <Text color={theme.text.muted}>{t("project.fieldDirectory")}</Text>
                    <Text color={theme.text.secondary}>{selected.directory}</Text>
                  </Box>
                ) : null}

                {selected.directory ? (
                  <Box>
                    <Text color={theme.text.muted}>Dir:      </Text>
                    <Text color={theme.text.secondary}>{selected.directory}</Text>
                  </Box>
                ) : null}

                {selected.isSystem && (
                  <Box marginTop={1}>
                    <Text color={theme.semantic.warning}>{t("project.systemLabel")}</Text>
                  </Box>
                )}
              </Box>

              <Box marginTop={1} flexDirection="column">
                <Box marginTop={1} flexDirection="row">
                  <FocusableButton
                    label={`${t("project.editProjectLabel")} (${t("project.keyEditHint")})`}
                    color={theme.accent.brand}
                    onPress={() => {
                      if (props.onNavigateEdit && selected) {
                        props.onNavigateEdit(selected);
                      }
                    }}
                  />
                  <FocusableButton
                    label={`${t("project.deleteProjectLabel")} (${t("project.keyDeleteHint")})`}
                    color={theme.semantic.danger}
                    variant="danger"
                    onPress={() => setSubModal("delete")}
                  />
                </Box>
                <Box marginTop={1}>
                  <Text color={theme.text.muted}>
                    {`${t("project.keyNewHint")} | ${t("project.keyEditHint")} | ${t("project.keyDeleteHint")}`}
                  </Text>
                </Box>
              </Box>
            </React.Fragment>
          ) : (
            <Box paddingX={1}>
              <Text color={theme.text.muted}>{t("project.noLoops")}</Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
