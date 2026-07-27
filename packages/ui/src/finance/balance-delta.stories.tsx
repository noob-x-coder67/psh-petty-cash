import type { Meta, StoryObj } from "@storybook/react-vite";
import { BalanceDelta } from "./balance-delta.js";

const meta: Meta<typeof BalanceDelta> = {
  title: "Finance/BalanceDelta",
  component: BalanceDelta,
};
export default meta;

type Story = StoryObj<typeof BalanceDelta>;

export const Increase: Story = { args: { value: 500 } };
export const Decrease: Story = { args: { value: -200 } };
export const NoChange: Story = { args: { value: 0 } };
