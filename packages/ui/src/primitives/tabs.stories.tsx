import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js";

const meta: Meta<typeof Tabs> = {
  title: "Primitives/Tabs",
  component: Tabs,
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const WorkspaceNavigation: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[500px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
        <TabsTrigger value="expenses">Expenses</TabsTrigger>
        <TabsTrigger value="reports">Reports Studio</TabsTrigger>
        <TabsTrigger value="month-close">Month Close</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Command Center content.</TabsContent>
      <TabsContent value="cash-flow">Cash Flow content.</TabsContent>
      <TabsContent value="expenses">Expenses content.</TabsContent>
      <TabsContent value="reports">Reports Studio content.</TabsContent>
      <TabsContent value="month-close">Month Close content.</TabsContent>
    </Tabs>
  ),
};
