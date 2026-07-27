import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComplianceRibbon } from "./compliance-ribbon.js";

const meta: Meta<typeof ComplianceRibbon> = {
  title: "Finance/ComplianceRibbon",
  component: ComplianceRibbon,
};
export default meta;

type Story = StoryObj<typeof ComplianceRibbon>;

export const ThreeMonthWindow: Story = {
  args: {
    months: [
      { label: "Apr", status: "CLOSED" },
      { label: "May", status: "CLOSED" },
      { label: "Jun", status: "HELD" },
      { label: "Jul", status: "OPEN" },
    ],
  },
};
