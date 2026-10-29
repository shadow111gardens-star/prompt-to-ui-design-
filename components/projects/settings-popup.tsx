"use client";
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import WorkspaceSettings from '@/components/projects/workspace-settings';

export default function SettingsPopup({providers,previewLifetime=false}:{providers:string[];previewLifetime?:boolean}){
  const router=useRouter();
  const [open,setOpen]=useState(true);
  const close=()=>{setOpen(false);router.replace('/dashboard/workspace');};
  return <Dialog open={open} onOpenChange={next=>{if(!next)close();}}><DialogContent className="flex h-[min(700px,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 sm:max-w-5xl"><DialogTitle className="sr-only">Workspace settings</DialogTitle><WorkspaceSettings providers={providers} previewLifetime={previewLifetime} onClose={close}/></DialogContent></Dialog>;
}
