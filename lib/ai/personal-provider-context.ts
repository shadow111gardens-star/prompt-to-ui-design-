import { AsyncLocalStorage } from 'node:async_hooks';
import type { PersonalSettings } from '@/lib/ai/personal-provider-types';
export const personalProviderContext=new AsyncLocalStorage<{uid:string;settings:PersonalSettings}>();
