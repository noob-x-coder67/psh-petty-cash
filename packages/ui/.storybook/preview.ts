import type { Preview } from "@storybook/react-vite";
import "./preview.css";

// AC-018 no-sidebar regression snapshot testing (Build Plan §7.1) and general visual
// review both run through Storybook — a11y test failures are build-breaking, not
// warnings, since NFR-005 targets WCAG 2.2 AA.
const preview: Preview = {
  parameters: {
    a11y: {
      test: "error",
    },
  },
};

export default preview;
