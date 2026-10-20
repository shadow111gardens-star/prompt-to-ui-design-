import type { Metadata } from 'next';
import AuthScreen from '@/components/site/auth-screen';
export const metadata:Metadata={title:'Create your account | OpenUI',description:'Create your OpenUI account with Google or email and password.'};
export default function SignUpPage(){return <AuthScreen initialMode="signup"/>;}
