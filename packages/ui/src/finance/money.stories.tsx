import type { Meta, StoryObj } from "@storybook/react-vite";
import { Money } from "./money.js";

const meta: Meta<typeof Money> = {
  title: "Finance/Money",
  component: Money,
};
export default meta;

type Story = StoryObj<typeof Money>;

export const Positive: Story = { args: { value: "12450.75" } };
export const Negative: Story = { args: { value: "-3200.00" } };
export const Zero: Story = { args: { value: 0 } };
