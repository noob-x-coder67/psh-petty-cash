import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button.js";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./sheet.js";

const meta: Meta<typeof Sheet> = {
  title: "Primitives/Sheet",
};
export default meta;

type Story = StoryObj<typeof Sheet>;

function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>Open voucher detail</Button>
      </SheetTrigger>
      <SheetContent open={open}>
        <SheetTitle>Voucher SOH-2026-000042</SheetTitle>
        <SheetDescription>Detail drawer — Register rows open here, not a route change.</SheetDescription>
      </SheetContent>
    </Sheet>
  );
}

export const Default: Story = { render: () => <SheetDemo /> };
