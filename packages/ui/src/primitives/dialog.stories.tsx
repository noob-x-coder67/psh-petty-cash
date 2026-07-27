import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./dialog.js";

const meta: Meta<typeof Dialog> = {
  title: "Primitives/Dialog",
};
export default meta;

type Story = StoryObj<typeof Dialog>;

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Reverse voucher</Button>
      </DialogTrigger>
      <DialogContent open={open}>
        <DialogTitle>Reverse voucher SOH-2026-000042</DialogTitle>
        <DialogDescription>This creates a compensating reversal voucher. Enter a reason.</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

export const Default: Story = { render: () => <DialogDemo /> };
