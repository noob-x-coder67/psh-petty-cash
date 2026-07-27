import type { Meta, StoryObj } from "@storybook/react-vite";
import { UnitPulseCard } from "./unit-pulse-card.js";

const meta: Meta<typeof UnitPulseCard> = {
  title: "Finance/UnitPulseCard",
  component: UnitPulseCard,
};
export default meta;

type Story = StoryObj<typeof UnitPulseCard>;

export const Healthy: Story = {
  args: { unitName: "PSH Sohawa", unitCode: "PSH-SOH", balance: 18450.5, uncheckedCount: 0 },
};
export const NegativeWithUnchecked: Story = {
  args: { unitName: "PSH Sukkur", unitCode: "PSH-SUK", balance: -2100, uncheckedCount: 4 },
};
