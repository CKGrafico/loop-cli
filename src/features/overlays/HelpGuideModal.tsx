import React from "react";
import { Box, Text, useInput } from "ink";
import { darkTheme as theme } from "../../shared/ui/theme.js";
import { Modal } from "../../shared/ui/Modal.js";
import { t } from "../../shared/i18n/index.js";

export function HelpGuideModal(props: {
  onClose: () => void;
}): React.ReactNode {
  useInput((_input, key) => {
    if (_input.includes("[<")) return;
    if (key.escape || _input === "q") {
      props.onClose();
    }
  });

  const sections: { title: string; body: string }[] = [
    { title: "", body: t("helpGuide.intro") },
    { title: t("helpGuide.commands"), body: t("helpGuide.examples") },
    { title: t("helpGuide.allCommands"), body: t("helpGuide.allCommands") },
    { title: t("helpGuide.confirm"), body: t("helpGuide.confirm") },
    { title: t("helpGuide.navigation"), body: t("helpGuide.navigation") },
    { title: t("helpGuide.ctrl"), body: t("helpGuide.ctrl") },
  ];

  return (
    <Modal title={t("helpGuide.title")} onClose={props.onClose} width="70%">
      {sections.map((section, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          {section.title.length > 0 ? (
            <Text color={theme.accent.brand} bold>
              {section.title}
            </Text>
          ) : null}
          <Text color={theme.text.primary}>{section.body}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color={theme.text.muted}>{t("helpGuide.esc")}</Text>
      </Box>
    </Modal>
  );
}
