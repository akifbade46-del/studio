'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/context/editor-context';
import { useToast } from '@/hooks/use-toast';

const CORRECT_PASSCODE = '1234';

export default function PasscodeDialog() {
  const { isEditorOpen, setEditorOpen, setUnlocked } = useEditor();
  const [passcode, setPasscode] = useState('');
  const { toast } = useToast();

  const handleUnlock = () => {
    if (passcode === CORRECT_PASSCODE) {
      setUnlocked(true);
    } else {
      toast({
        variant: 'destructive',
        title: 'Incorrect Passcode',
        description: 'Please try again.',
      });
      setUnlocked(false);
    }
    setPasscode('');
    setEditorOpen(false); // Close dialog regardless of success
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
        setPasscode('');
        setEditorOpen(false);
    }
  }

  return (
    <Dialog open={isEditorOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Enter Editor Mode</DialogTitle>
          <DialogDescription>
            Enter the passcode to make changes to the app settings.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            id="passcode"
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleUnlock}>Unlock Editor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
