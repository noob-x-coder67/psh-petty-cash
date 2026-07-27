import type { Meta, StoryObj } from "@storybook/react-vite";
import { VarianceCell } from "./variance-cell.js";

const meta: Meta<typeof VarianceCell> = {
  title: "Finance/VarianceCell",
  component: VarianceCell,
};
export default meta;

type Story = StoryObj<typeof VarianceCell>;

export const Matched: Story = { args: { expected: 5000, actual: 5000 } };
export const Shortfall: Story = { args: { expected: 5000, actual: 4700 } };
export const Surplus: Story = { args: { expected: 5000, actual: 5150 } };
