import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ContentPage from '@/components/site/content-page';
import ProductPage, { isProductSlug } from '@/components/site/product-page';
import BlogPage from '@/components/site/blog-page';
import ContactPage from '@/components/site/contact-page';
import { sitePages } from '@/lib/site-pages';

export const dynamicParams = false;
export function generateStaticParams(){return Object.keys(sitePages).map(slug=>({slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const page=sitePages[slug];return page?{title:`${slug[0].toUpperCase()+slug.slice(1)} | OpenUI`,description:page.description}:{};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const page=Object.hasOwn(sitePages,slug)?sitePages[slug]:undefined;if(!page)notFound();if(slug==='blog')return <BlogPage/>;if(slug==='contact')return <ContactPage/>;return isProductSlug(slug)?<ProductPage page={page} slug={slug}/>:<ContentPage page={page} slug={slug}/>;}
