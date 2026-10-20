"use client";
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/components/auth/provider';
import { authErrorMessage } from '@/lib/firebase/errors';
export default function LogoutButton(){const {logout}=useAuth();const [busy,setBusy]=useState(false),[error,setError]=useState('');return <div><button type="button" aria-label="Sign out" disabled={busy} onClick={()=>{setBusy(true);setError('');void logout().catch(failure=>{setError(authErrorMessage(failure));setBusy(false);});}} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"><LogOut size={15}/><span className="inline">{busy?'Signing out...':'Sign out'}</span></button>{error&&<p role="alert" className="max-w-64 text-xs text-destructive">{error}</p>}</div>;}
