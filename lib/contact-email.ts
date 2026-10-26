import { z } from 'zod';

export const CONTACT_NAME = 'Abhay Solanki';
export const CONTACT_EMAIL = 'solankiabhay722@gmail.com';
export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(100, 'Keep your name under 100 characters.').refine(value => !/[\r\n]/.test(value), 'Enter your name on one line.'),
  email: z.string().trim().max(254).email('Enter a valid email address.'),
  subject: z.enum(['Product question', 'Report a problem', 'Privacy or security', 'Something else']),
  message: z.string().trim().min(10, 'Add a little more detail (at least 10 characters).').max(2000, 'Keep your message under 2,000 characters.'),
});

export function createContactEmail(input: unknown) {
  const data = contactSchema.parse(input);
  const subject = `OpenUI: ${data.subject} — ${data.name}`;
  const body = `Name: ${data.name}\nReply email: ${data.email}\n\n${data.message}`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
