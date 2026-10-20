import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ContentPage from '@/components/site/content-page';
import { sitePages } from '@/lib/site-pages';

export const dynamicParams = false;
export function generateStaticParams(){return Object.keys(sitePages).map(slug=>({slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const page=sitePages[slug];return page?{title:`${slug[0].toUpperCase()+slug.slice(1)} | OpenUI`,description:page.description}:{};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const page=Object.hasOwn(sitePages,slug)?sitePages[slug]:undefined;if(!page)notFound();return <ContentPage page={page} slug={slug}/>;}
