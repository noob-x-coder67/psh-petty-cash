import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card.js";

const meta: Meta<typeof Card> = {
  title: "Primitives/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>PSH-SOH</CardTitle>
        <CardDescription>Pakistan Sweet Home Cadet College Sohawa</CardDescription>
      </CardHeader>
      <CardContent>Cash balance and recent activity render here.</CardContent>
    </Card>
  ),
};
