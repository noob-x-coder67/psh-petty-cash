import type { Meta, StoryObj } from "@storybook/react-vite";
import { CategoryChip } from "./category-chip.js";

const meta: Meta<typeof CategoryChip> = {
  title: "Finance/CategoryChip",
  component: CategoryChip,
};
export default meta;

type Story = StoryObj<typeof CategoryChip>;

export const AllCategories: Story = {
  render: () => (
    <div className="flex gap-2">
      <CategoryChip category="BUILDING" />
      <CategoryChip category="VEHICLE" />
      <CategoryChip category="OTHER" />
    </div>
  ),
};
