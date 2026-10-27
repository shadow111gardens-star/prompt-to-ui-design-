"use client";
import { toast } from 'sonner';
export async function reportSavedCredits(response:Response){try{const body=await response.clone().json();if(body.credits?.accepted>0)window.dispatchEvent(new Event('openui-credits-changed'));for(const receipt of body.credits?.receipts||[])if(receipt.credits===15)toast.success('15 credits used.',{id:'credits:'+receipt.id});}catch{/* The persisted save result remains authoritative even if a notification fails. */}}
