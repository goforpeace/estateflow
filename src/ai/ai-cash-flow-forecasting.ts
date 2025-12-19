// src/ai/ai-cash-flow-forecasting.ts
'use server';

/**
 * @fileOverview AI-powered cash flow forecasting tool.
 *
 * - forecastCashFlow - A function that forecasts cash flow for a project.
 * - CashFlowForecastInput - The input type for the forecastCashFlow function.
 * - CashFlowForecastOutput - The return type for the forecastCashFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CashFlowForecastInputSchema = z.object({
  historicalData: z
    .string()
    .describe(
      'Historical cash flow data for the project, including inflows and outflows, as a JSON string.'
    ),
  paymentSchedules: z
    .string()
    .describe(
      'Payment schedules for ongoing projects, including due dates and amounts, as a JSON string.'
    ),
  projectName: z.string().describe('The name of the project.'),
});
export type CashFlowForecastInput = z.infer<typeof CashFlowForecastInputSchema>;

const CashFlowForecastOutputSchema = z.object({
  forecastSummary: z
    .string()
    .describe(
      'A summary of the cash flow forecast, including potential shortages or surpluses.'
    ),
  recommendations: z
    .string()
    .describe(
      'Recommendations for mitigating potential cash shortages or leveraging potential surpluses.'
    ),
});
export type CashFlowForecastOutput = z.infer<typeof CashFlowForecastOutputSchema>;

export async function forecastCashFlow(input: CashFlowForecastInput): Promise<CashFlowForecastOutput> {
  return cashFlowForecastFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cashFlowForecastPrompt',
  input: {schema: CashFlowForecastInputSchema},
  output: {schema: CashFlowForecastOutputSchema},
  prompt: `You are an expert financial analyst specializing in real estate development projects.

You are tasked with forecasting the cash flow for the project: {{{projectName}}}.

Based on the following historical cash flow data:
{{{historicalData}}}

And the following payment schedules:
{{{paymentSchedules}}}

Provide a summary of the cash flow forecast, including potential shortages or surpluses, and recommendations for mitigating potential cash shortages or leveraging potential surpluses.

Format your response as a JSON object that matches the schema:
${JSON.stringify(CashFlowForecastOutputSchema.description)}`,
});

const cashFlowForecastFlow = ai.defineFlow(
  {
    name: 'cashFlowForecastFlow',
    inputSchema: CashFlowForecastInputSchema,
    outputSchema: CashFlowForecastOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
