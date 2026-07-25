import React, { useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { darkTheme as theme } from "./theme.js";

export function FocusableList<T>(props: {
  items: T[];
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
  selectedIndex: number;
  isFocused: boolean;
  navActive?: boolean;
  limit: number;
}): React.ReactNode {
  const {
    items,
    renderItem,
    onSelect,
    onActivate,
    selectedIndex,
    isFocused,
    navActive = true,
    limit,
  } = props;

  const n = items.length;

  useInput(
    (input, key) => {
      if (n === 0) return;
      if (input.includes("[<")) return;
      if (key.upArrow || input === "k") {
        const next = selectedIndex <= 0 ? n - 1 : selectedIndex - 1;
        onSelect(next);
        return;
      }
      if (key.downArrow || input === "j") {
        const next = selectedIndex >= n - 1 ? 0 : selectedIndex + 1;
        onSelect(next);
        return;
      }
      if (key.return) {
        onActivate(selectedIndex);
        return;
      }
    },
    { isActive: isFocused && navActive },
  );

  const { visible, localSelected } = useMemo(() => {
    if (n === 0) return { visible: [] as T[], localSelected: 0 };
    const eff = Math.min(limit, n);
    if (n <= eff) {
      return { visible: items, localSelected: selectedIndex };
    }
    const offset = Math.floor(eff / 2);
    const r = (((selectedIndex - offset) % n) + n) % n;
    const rotated = [...items.slice(r), ...items.slice(0, r)];
    return { visible: rotated.slice(0, eff), localSelected: offset };
  }, [items, selectedIndex, limit, n]);

  if (n === 0) {
    throw new Error("FocusableList requires at least one item");
  }

  return (
    <Box flexDirection="column">
      {visible.map((item, i) => {
        const isSelected = i === localSelected;
        const indicator = isSelected ? "\u203a " : "  ";
        return (
          <Box
            key={i}
            backgroundColor={isSelected ? (isFocused && navActive ? theme.bg.active : isFocused ? theme.bg.hover : undefined) : undefined}
          >
            <Text color={isSelected ? theme.text.inverse : theme.text.primary}>
              {indicator}
            </Text>
            {renderItem(item, isSelected)}
          </Box>
        );
      })}
    </Box>
  );
}
