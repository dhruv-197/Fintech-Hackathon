import { GoogleGenAI } from "@google/genai";
import { GLAccount } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY for Gemini is not set in environment variables. Chat functionality will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const getChatResponse = async (
  userInput: string,
  glAccounts: GLAccount[]
): Promise<string> => {
  if (!API_KEY) {
    return "The AI chat feature is currently disabled because the API key is not configured.";
  }

  const model = 'gemini-2.5-flash';
  
  const formattedData = glAccounts.map(acc => ({
      "GL Account": acc.glAccount,
      "Account Number": acc.glAccountNumber,
      "Department": acc.responsibleDept,
      "Category": acc.mainHead,
      "Review Status": acc.reviewStatus,
      "Current Stage": acc.currentChecker || 'Finalized',
      "Reviewer": acc.reviewer,
      "SPOC": acc.spoc,
      "Mistake Count": acc.mistakeCount
  }));

  const prompt = `
    You are FinSight AI, an intelligent assistant for financial auditing and workflow analysis.
    Your task is to answer questions based ONLY on the following JSON data representing General Ledger (GL) accounts and their current review status.
    Do not make up information or answer questions outside of this data context. If the answer is not in the data, state that clearly.
    Analyze the data to provide accurate, concise, and professional answers.

    Data Schema Guide:
    - "Review Status": The status of the item (e.g., Pending, Mismatch, Finalized).
    - "Current Stage": The current person/team responsible for the next action (e.g., Checker 1, Checker 2, Finalized).

    Here is the GL accounts data:
    ${JSON.stringify(formattedData, null, 2)}

    User's question: "${userInput}"

    Your Answer:
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Sorry, I encountered an error while processing your request. Please check the console for details.";
  }
};
