import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input, Label } from "./input.js";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-1.5">
      <Label htmlFor="vendor-name-story">Vendor name</Label>
      <Input id="vendor-name-story" placeholder="e.g. Al-Fateh Hardware" />
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true, placeholder: "Disabled" } };
