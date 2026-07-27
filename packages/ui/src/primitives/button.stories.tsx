import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button.js";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { children: "Save voucher", variant: "primary" } };
export const Secondary: Story = { args: { children: "Cancel", variant: "secondary" } };
export const Ghost: Story = { args: { children: "Dismiss", variant: "ghost" } };
export const Destructive: Story = { args: { children: "Reverse", variant: "destructive" } };
export const Disabled: Story = { args: { children: "Save voucher", disabled: true } };
