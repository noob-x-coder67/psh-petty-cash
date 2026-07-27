import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckedMarker } from "./checked-marker.js";

const meta: Meta<typeof CheckedMarker> = {
  title: "Finance/CheckedMarker",
  component: CheckedMarker,
};
export default meta;

type Story = StoryObj<typeof CheckedMarker>;

export const Checked: Story = { args: { checked: true } };
export const Unchecked: Story = { args: { checked: false } };
