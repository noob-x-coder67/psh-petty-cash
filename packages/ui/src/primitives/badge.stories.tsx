import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./badge.js";

const meta: Meta<typeof Badge> = {
  title: "Primitives/Badge",
  component: Badge,
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="neutral">Neutral</Badge>
      <Badge variant="positive">Positive</Badge>
      <Badge variant="attention">Attention</Badge>
      <Badge variant="negative">Negative</Badge>
      <Badge variant="analytical">Analytical</Badge>
    </div>
  ),
};
