'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a concise quote summary,
 * including key details and a link to the PDF document for easy sharing via WhatsApp.
 *
 * @exports generateQuoteSummary - An asynchronous function to generate the quote summary.
 * @exports GenerateQuoteSummaryInput - The input type for the generateQuoteSummary function.
 * @exports GenerateQuoteSummaryOutput - The output type for the generateQuoteSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuoteSummaryInputSchema = z.object({
  customerName: z.string().describe('The name of the customer.'),
  totalCbm: z.number().describe('The total CBM of the items.'),
  containerType: z.string().describe('The type of container recommended.'),
  grandTotal: z.number().describe('The grand total amount of the quote.'),
  currency: z.string().describe('The currency of the quote.'),
  pdfLink: z.string().describe('A link to the generated PDF document.'),
});
export type GenerateQuoteSummaryInput = z.infer<typeof GenerateQuoteSummaryInputSchema>;

const GenerateQuoteSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the quote for sharing.'),
});
export type GenerateQuoteSummaryOutput = z.infer<typeof GenerateQuoteSummaryOutputSchema>;

export async function generateQuoteSummary(input: GenerateQuoteSummaryInput): Promise<GenerateQuoteSummaryOutput> {
  return generateQuoteSummaryFlow(input);
}

const generateQuoteSummaryPrompt = ai.definePrompt({
  name: 'generateQuoteSummaryPrompt',
  input: {schema: GenerateQuoteSummaryInputSchema},
  output: {schema: GenerateQuoteSummaryOutputSchema},
  prompt: `You are an AI assistant helping surveyors quickly share quote summaries with customers via WhatsApp.

  Generate a professional and detailed summary of the quote using the following information:

  Customer Name: {{{customerName}}}
  Total CBM: {{{totalCbm}}}
  Container Type: {{{containerType}}}
  Grand Total: {{{grandTotal}}} {{{currency}}}
  Link to full PDF Quote: {{{pdfLink}}}

  The summary should be formatted nicely for WhatsApp. It should greet the customer, provide the key details of the quote (Total Volume, Container, and Grand Total), and end with a friendly closing and a call to action to view the full PDF quote.
`,
});

const generateQuoteSummaryFlow = ai.defineFlow(
  {
    name: 'generateQuoteSummaryFlow',
    inputSchema: GenerateQuoteSummaryInputSchema,
    outputSchema: GenerateQuoteSummaryOutputSchema,
  },
  async input => {
    const {output} = await generateQuoteSummaryPrompt(input);
    return output!;
  }
);
