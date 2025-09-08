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

  Generate a concise and professional summary of the quote using the following information:

  Customer Name: {{{customerName}}}
  Total CBM: {{{totalCbm}}}
  Container Type: {{{containerType}}}
  Grand Total: {{{grandTotal}}} KWD
  PDF Link: {{{pdfLink}}}

  The summary should be no more than two sentences and include a call to action to view the attached PDF for complete details.
  Consider shortening the PDF link if it is too long.
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
