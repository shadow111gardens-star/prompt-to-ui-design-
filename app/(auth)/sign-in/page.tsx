import type { Metadata } from 'next';
import AuthScreen from '@/components/site/auth-screen';

export const metadata: Metadata = { title: 'Sign in | OpenUI', description: 'Create your OpenUI account or sign in to continue designing.' };
export default function SignInPage(){return <AuthScreen initialMode="signin"/>;}
