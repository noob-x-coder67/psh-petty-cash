import type { Meta, StoryObj } from "@storybook/react-vite";
import { Printer } from "lucide-react";
import { Button } from "./button.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip.js";

const meta: Meta<typeof Tooltip> = {
  title: "Primitives/Tooltip",
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

export const IconOnlyButton: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Print voucher">
            <Printer className="h-4 w-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Print voucher</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
