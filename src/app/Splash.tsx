import React, { useState, useEffect } from "react";
import { Text } from "ink";

const LOGO = [
  "  _                         _         _       ",
  " | |                       | |       | |      ",
  " | |     ___  ___  ___ _ __| |____  _| |__    ",
  " | |    / _ \\/ __|/ _ \\ '__| '_ \\ \\/ / '_ \\   ",
  " | |___| (_) \\__ \\  __/ |  | |_) >  <| |_) |  ",
  " |______\\___/|___/\\___|_|  |_.__/_/\\_\\_|___/  ",
];

const DOTS = [".  ", ".. ", "...", " ..", "  .", "   "];

export function Splash(): React.ReactNode {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % DOTS.length), 200);
    return () => clearInterval(timer);
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    ...LOGO.map((line, i) =>
      React.createElement(Text, { key: i, color: "cyan", bold: true }, line)
    ),
    React.createElement(Text, { color: "gray" }, `Loading${DOTS[frame]}`),
  );
}
