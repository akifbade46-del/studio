import { getFormData } from './script.js';

async function callGeminiApi(payload, retries = 3, delay = 1000) {
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 429 && retries > 0) {
                console.warn(`API call failed with status 429. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return callGeminiApi(payload, retries - 1, delay * 2);
            }
            throw new Error(`API call failed with status ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            console.warn(`API call failed. Retrying in ${delay}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
            return callGeminiApi(payload, retries - 1, delay * 2);
        }
        console.error("API call failed after multiple retries:", error);
        throw error;
    }
}


export async function suggestCharges(chargeDescriptions) {
    window.showLoader();
    try {
        const data = getFormData();
        
        const prompt = `
            Based on the following freight forwarding job details, suggest typical cost and selling prices in Kuwaiti Dinar (KD) for relevant charges.
            Provide reasonable, non-zero estimates for relevant charges. Only include charges that are applicable.
            
            - Product Type: ${(data.pt || []).join(', ') || 'General'}
            - Clearance Type: ${(data.cl || []).join(', ') || 'Standard'}
            - Origin: ${data.or || 'Unknown'}
            - Destination: ${data.de || 'Unknown'}
            - Description of Goods: ${data.dsc || 'General Goods'}
            - Gross Weight: ${data.gw || 'N/A'}
            - Predefined Charges: ${chargeDescriptions.join(', ')}

            Which of the predefined charges are most relevant and what are their estimated costs and selling prices?
        `;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        charges: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    chargeName: { type: "STRING" },
                                    cost: { type: "NUMBER" },
                                    selling: { type: "NUMBER" }
                                },
                                required: ["chargeName", "cost", "selling"]
                            }
                        }
                    }
                }
            }
        };

        const result = await callGeminiApi(payload);

        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            
            const jsonText = result.candidates[0].content.parts[0].text;
            const parsedJson = JSON.parse(jsonText);
            
            if (parsedJson.charges && Array.isArray(parsedJson.charges)) {
                const tableBody = document.getElementById('charges-table-body');
                tableBody.innerHTML = '';
                if(parsedJson.charges.length === 0){
                     for(let i=0; i<5; i++) window.addChargeRow();
                } else {
                    parsedJson.charges.forEach(charge => {
                        window.addChargeRow({
                            l: charge.chargeName,
                            c: charge.cost || 0,
                            s: charge.selling || 0,
                            n: ''
                        });
                    });
                }
                
                window.calculate();
                window.showNotification("Charges suggested successfully! ✨");
            } else {
                 throw new Error("Invalid JSON structure in API response.");
            }
        } else {
            throw new Error("Invalid response structure from Gemini API.");
        }

    } catch (error) {
        console.error("Error suggesting charges:", error);
        window.showNotification("Could not suggest charges. Please try again.", true);
    } finally {
        window.hideLoader();
    }
}
