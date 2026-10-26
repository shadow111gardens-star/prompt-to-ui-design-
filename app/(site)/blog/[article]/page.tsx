import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { blogArticles } from '@/lib/site-pages';
import BlogPage from '@/components/site/blog-page';

export const dynamicParams=false;
export function generateStaticParams(){return Object.keys(blogArticles).map(article=>({article}));}
export async function generateMetadata({params}:{params:Promise<{article:string}>}):Promise<Metadata>{const {article}=await params;const page=blogArticles[article];return page?{title:`${page.title} | OpenUI`,description:page.description}:{};}
export default async function Article({params}:{params:Promise<{article:string}>}){const {article}=await params;const page=Object.hasOwn(blogArticles,article)?blogArticles[article]:undefined;if(!page)notFound();return <BlogPage articleSlug={article}/>;}
